import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiFetch } from '../lib/api'

type SquadDetail = {
  squad: {
    id: string
    name: string
    book_title: string
    created_at: string
    created_by: string
  }
  members: Array<{
    user_id: string
    role: string
    joined_at: string
    display_name: string
  }>
}

type CheckIn = {
  id: string
  user_id: string
  note: string | null
  progress: string
  checked_in_at: string
  created_at: string
  display_name: string
}

function utcTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function checkInDateKey(isoOrDate: string): string {
  return isoOrDate.slice(0, 10)
}

export function SquadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, user } = useAuth()
  const [detail, setDetail] = useState<SquadDetail | null>(null)
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [progress, setProgress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const alreadyCheckedInTodayUtc = useMemo(() => {
    const uid = user?.id
    if (!uid) return false
    const today = utcTodayString()
    return checkIns.some(
      (c) => c.user_id === uid && checkInDateKey(c.checked_in_at) === today,
    )
  }, [checkIns, user?.id])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(t)
  }, [toast])

  const load = useCallback(async () => {
    if (!accessToken || !id) return
    setDetail(null)
    setCheckIns([])
    setLoading(true)
    setError(null)
    try {
      const d = await apiFetch<SquadDetail>(`/api/squads/${id}`, accessToken)
      setDetail(d)
      const c = await apiFetch<CheckIn[]>(`/api/squads/${id}/check-ins`, accessToken)
      setCheckIns(c)
    } catch (e: unknown) {
      setDetail(null)
      setCheckIns([])
      setError(e instanceof ApiError ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [accessToken, id])

  /** 仅刷新打卡记录（不改变小队详情与其它区块） */
  const loadCheckIns = useCallback(async () => {
    if (!accessToken || !id) return
    try {
      const c = await apiFetch<CheckIn[]>(
        `/api/squads/${id}/check-ins`,
        accessToken,
      )
      setCheckIns(c)
    } catch (e: unknown) {
      setToast(e instanceof ApiError ? e.message : '打卡列表更新失败')
    }
  }, [accessToken, id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount / token / squad id 变化时拉取
    void load()
  }, [load])

  async function submitCheckIn(e: FormEvent) {
    e.preventDefault()
    if (!accessToken || !id || alreadyCheckedInTodayUtc) return
    setIsSubmitting(true)
    try {
      await apiFetch(`/api/squads/${id}/check-ins`, accessToken, {
        method: 'POST',
        body: JSON.stringify({
          note: note.trim() || undefined,
          progress: progress.trim() || undefined,
        }),
      })
      setNote('')
      setProgress('')
      setToast('打卡已记录')
      await loadCheckIns()
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : '打卡失败'
      setToast(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!id) return <Navigate to="/squads" replace />

  const formLocked =
    alreadyCheckedInTodayUtc || loading || isSubmitting

  return (
    <div className="shell wide">
      <div className="toast-host" aria-live="polite">
        {toast ? <p className="toast-card">{toast}</p> : null}
      </div>
      <p className="nav-back">
        <Link to="/squads">← 返回小队书架</Link>
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !detail ? (
        <section className="hero-book" aria-busy="true">
          <div className="hero-book__spine" />
          <div className="hero-book__body">
            <div className="skeleton-block">
              <div className="skeleton-line medium" />
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
            </div>
          </div>
        </section>
      ) : null}

      {detail ? (
        <>
          <header className="hero-book">
            <div className="hero-book__spine" aria-hidden />
            <div className="hero-book__body">
              <h1>{detail.squad.name}</h1>
              <p className="hero-book__meta">
                《{detail.squad.book_title}》 · 创建于{' '}
                {new Date(detail.squad.created_at).toLocaleString()}
              </p>
              <div className="hero-book__share">
                小队 ID（分享给队友加入）
                <br />
                <code>{detail.squad.id}</code>
              </div>
            </div>
          </header>

          <section className="panel">
            <h2>成员</h2>
            <ul className="list compact">
              {detail.members.map((m) => (
                <li key={m.user_id}>
                  <strong title={m.user_id}>{m.display_name}</strong>
                  <span className="pill">{m.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>今日打卡</h2>
            {alreadyCheckedInTodayUtc ? (
              <p className="muted small" role="status">
                你在今日（UTC）已为该小队打过卡，明天再来记录进度。
              </p>
            ) : null}
            <form className="grid-inline" onSubmit={(e) => void submitCheckIn(e)}>
              <label className="field">
                <span>进度（章节 / 页码）</span>
                <input
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                  placeholder="如：第 3 章"
                  disabled={formLocked}
                />
              </label>
              <label className="field">
                <span>备注（可选）</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="一句话"
                  disabled={formLocked}
                />
              </label>
              <button type="submit" disabled={formLocked}>
                {alreadyCheckedInTodayUtc
                  ? '今日已打卡'
                  : isSubmitting
                    ? '提交中…'
                    : '提交打卡'}
              </button>
            </form>
            <p className="muted small">同一小队每人每个日历日（UTC）一条；重复提交会以底部提示告知。</p>
          </section>

          <section className="panel">
            <h2>打卡记录</h2>
            {checkIns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__mark" aria-hidden>
                  ✎
                </div>
                <p className="empty-state__title">尚无批注</p>
                <p className="empty-state__hint">读完一段就来记一笔进度吧，时间会排在左侧页边。</p>
              </div>
            ) : (
              <ul className="timeline">
                {checkIns.map((c) => (
                  <li key={c.id}>
                    <div className="t-date">{c.checked_in_at}</div>
                    <div className="timeline-entry">
                      <p className="timeline-meta">
                        <span className="timeline-who" title={c.user_id}>
                          {c.display_name}
                        </span>
                      </p>
                      {c.note ? (
                        <>
                          <p className="timeline-note">{c.note}</p>
                          {c.progress ? (
                            <p className="timeline-progress-sub">{c.progress}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="timeline-lead">{c.progress || '—'}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
