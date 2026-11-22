import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './AuthPanel.css'

type CurrentUser = {
  id: string
  username: string
}

type SessionState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'error'; message: string }

class AuthError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function authRequest(
  path: string,
  method = 'GET',
  body?: { username: string; password: string },
): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    10000,
  )

  try {
    const response = await fetch(`/api/auth/${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Ticketflow-Request': '1',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)

      const message =
        typeof data?.detail === 'string'
          ? data.detail
          : `Request failed (HTTP ${response.status}). Please check your input.`

      throw new AuthError(response.status, message)
    }

    return response
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new Error(
        'Request timed out. Check your session before trying again.',
      )
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Unable to reach the server.'
}

function AuthPanel() {
  const [session, setSession] = useState<SessionState>({
    status: 'checking',
  })

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [checkAttempt, setCheckAttempt] = useState(0)

  // Prevent multiple submissions before React updates the button state.
  const submitting = useRef(false)

  useEffect(() => {
    let active = true

    async function checkSession() {
      try {
        const response = await authRequest('me')
        const user: CurrentUser = await response.json()

        if (active) {
          setSession({
            status: 'authenticated',
            user,
          })
        }
      } catch (error: unknown) {
        if (!active) {
          return
        }

        if (error instanceof AuthError && error.status === 401) {
          setSession({ status: 'anonymous' })
        } else {
          setSession({
            status: 'error',
            message: errorMessage(error),
          })
        }
      }
    }

    void checkSession()

    return () => {
      active = false
    }
  }, [checkAttempt])

  function recheckSession() {
    setMessage('')
    setSession({ status: 'checking' })
    setCheckAttempt((current) => current + 1)
  }

  function changeMode(nextMode: 'login' | 'register') {
    setMode(nextMode)
    setMessage('')
    setPassword('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (submitting.current) {
      return
    }

    submitting.current = true
    setBusy(true)
    setMessage('')

    try {
      const response = await authRequest(mode, 'POST', {
        username,
        password,
      })

      const user: CurrentUser = await response.json()

      setSession({
        status: 'authenticated',
        user,
      })

      setPassword('')
    } catch (error: unknown) {
      setMessage(errorMessage(error))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  async function handleLogout() {
    if (submitting.current) {
      return
    }

    submitting.current = true
    setBusy(true)
    setMessage('')

    try {
      await authRequest('logout', 'POST')
      setSession({ status: 'anonymous' })
      setPassword('')
      setMessage('You have signed out.')
    } catch (error: unknown) {
      setMessage(errorMessage(error))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <section
      className="auth-panel"
      aria-labelledby="account-heading"
    >
      <h2 id="account-heading">Your account</h2>

      {session.status === 'checking' && (
        <p role="status">Checking your session…</p>
      )}

      {session.status === 'error' && (
        <div>
          <p role="alert">{session.message}</p>

          <button
            type="button"
            className="event-button"
            onClick={recheckSession}
          >
            Check session again
          </button>
        </div>
      )}

      {session.status === 'authenticated' && (
        <div className="auth-account">
          <p>
            Signed in as <strong>{session.user.username}</strong>
          </p>

          <div className="auth-actions">
            <button
              type="button"
              className="clear-button"
              disabled={busy}
              onClick={recheckSession}
            >
              Check session
            </button>

            <button
              type="button"
              className="event-button"
              disabled={busy}
              onClick={handleLogout}
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}

      {session.status === 'anonymous' && (
        <>
          <div className="auth-actions">
            <button
              type="button"
              className="event-button"
              aria-pressed={mode === 'login'}
              disabled={busy}
              onClick={() => changeMode('login')}
            >
              Sign in
            </button>

            <button
              type="button"
              className="event-button"
              aria-pressed={mode === 'register'}
              disabled={busy}
              onClick={() => changeMode('register')}
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="account-username">
              Username

              <input
                id="account-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9_]+"
                required
                disabled={busy}
                aria-describedby="username-help"
              />
            </label>

            <label htmlFor="account-password">
              Password

              <input
                id="account-password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'register'
                    ? 'new-password'
                    : 'current-password'
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                aria-describedby="password-help"
              />
            </label>

            <button
              type="submit"
              className="event-button"
              disabled={busy}
            >
              {busy
                ? 'Please wait…'
                : mode === 'register'
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          <p id="username-help" className="auth-help">
            Usernames use 3–40 letters, numbers, or underscores.
            Capitalization is ignored.
          </p>

          <p id="password-help" className="auth-help">
            Passwords use 12–128 characters.
            Sessions last up to 12 hours.
          </p>

          <button
            type="button"
            className="clear-button"
            disabled={busy}
            onClick={recheckSession}
          >
            Check session
          </button>
        </>
      )}

      {message && (
        <p role="status" className="auth-message">
          {message}
        </p>
      )}
    </section>
  )
}

export default AuthPanel