import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiFetch } from '../lib/api'

type SquadRow = {
  role: string
  squad: {
    id: string
    name: string
    book_title: string
    created_at: string
  }
}

export function SquadsPage() {
  const { accessToken, signOut } = useAuth()
  const [rows, setRows] = useState<SquadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [bookTitle, setBookTitle] = useState('')
  const [joinId, setJoinId] = useState('')

  const load = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<SquadRow[]>('/api/squads', accessToken)
      setRows(data)
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount / token 变化时拉取列表
    void load()
  }, [load])

  async function createSquad(e: FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setError(null)
    try {
      await apiFetch('/api/squads', accessToken, {
        method: 'POST',
        body: JSON.stringify({ name, bookTitle }),
      })
      setName('')
      setBookTitle('')
      await load()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : '创建失败')
    }
  }

  async function joinSquad(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || !joinId.trim()) return
    setError(null)
    try {
      await apiFetch(`/api/squads/${joinId.trim()}/join`, accessToken, {
        method: 'POST',
      })
      setJoinId('')
      await load()
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : '加入失败')
    }
  }

  return (
    <div className="shell wide">
      <header className="topbar">
        <div>
          <h1>我的小队</h1>
          <p className="muted">共读打卡 · 纸质书小队（练习版）</p>
        </div>
        <button type="button" className="ghost" onClick={() => void signOut()}>
          退出
        </button>
      </header>

      <section className="grid">
        <div className="panel">
          <h2>新建小队</h2>
          <form onSubmit={(e) => void createSquad(e)}>
            <label className="field">
              <span>小队名</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>共读书名</span>
              <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} required />
            </label>
            <button type="submit">创建</button>
          </form>
        </div>
        <div className="panel">
          <h2>加入小队</h2>
          <p className="muted small">向队长索要小队 ID（UUID），粘贴后加入。</p>
          <form onSubmit={(e) => void joinSquad(e)}>
            <label className="field">
              <span>小队 ID</span>
              <input
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
              />
            </label>
            <button type="submit">加入</button>
          </form>
        </div>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="panel">
        <h2>小队书架</h2>
        {loading ? (
          <>
            <p className="loading-hint">正在翻开书架…</p>
            <div className="skeleton-block" aria-hidden>
              <div className="skeleton-card" />
              <div className="skeleton-card" />
              <div className="skeleton-card" />
            </div>
          </>
        ) : null}
        {!loading && rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__mark" aria-hidden>
              📖
            </div>
            <p className="empty-state__title">还没有小队</p>
            <p className="empty-state__hint">
              在上方新建一本「共读」，或向队友要来小队 ID 加入。第一本小队出现后会显示在这里。
            </p>
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="list">
            {rows.map((r) => (
              <li key={r.squad.id}>
                <Link to={`/squads/${r.squad.id}`}>
                  <strong>{r.squad.name}</strong>
                  <span className="muted small">《{r.squad.book_title}》</span>
                </Link>
                <span className="pill">{r.role}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
