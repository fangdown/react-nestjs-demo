import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function LoginPage() {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await signIn(email, password)
      nav('/squads', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败')
    }
  }

  return (
    <div className="shell">
      <div className="panel">
        <h1>登录</h1>
        <p className="muted">共读打卡 · 小队练习</p>
        <aside className="demo-account">
          <p className="demo-account__title">演示账号</p>
          <p className="demo-account__cred">
            <span>fang2@qq.com</span>
            <span className="demo-account__sep">·</span>
            <span>123456</span>
          </p>
          <button
            type="button"
            className="ghost demo-account__fill"
            onClick={() => {
              setEmail('fang2@qq.com')
              setPassword('123456')
            }}
          >
            填入表单
          </button>
          <p className="muted small demo-account__hint">
            公开演示用；自建环境请改用自有账号并做好密码安全。
          </p>
        </aside>
        <form onSubmit={(e) => void onSubmit(e)}>
          <label className="field">
            <span>邮箱</span>
            <input
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">进入</button>
        </form>
        <p className="muted">
          还没有账号？ <Link to="/register">注册</Link>
        </p>
      </div>
    </div>
  )
}
