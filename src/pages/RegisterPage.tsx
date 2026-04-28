import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function RegisterPage() {
  const { signUp } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const { session } = await signUp(email, password)
      if (session) {
        nav('/squads', { replace: true })
        return
      }
      // 无 session：多为已开启「确认邮件」，需用户收信后验证
      setPendingConfirm(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败')
    }
  }

  return (
    <div className="shell">
      <div className="panel">
        <h1>注册</h1>
        <p className="muted">
          若已在 Supabase 开启邮箱验证，提交注册后请到邮箱点击确认链接，再回到{' '}
          <Link to="/login">登录</Link>。
        </p>
        {pendingConfirm ? (
          <div className="register-followup">
            <p role="status">
              已向你的邮箱发送验证链接（若未见，可在垃圾箱里找一封来自 Supabase
              / 邮件服务商的邮件）。验证完成后即可用该邮箱登录。
            </p>
            <p>
              <Link to="/login">去登录</Link>
            </p>
          </div>
        ) : (
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
                autoComplete="new-password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit">创建账号</button>
          </form>
        )}
        <p className="muted">
          已有账号？ <Link to="/login">登录</Link>
        </p>
      </div>
    </div>
  )
}
