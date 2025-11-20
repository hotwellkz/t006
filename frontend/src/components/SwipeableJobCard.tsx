import React, { useState, useRef, useEffect } from 'react'
import { VideoJob } from '../hooks/useVideoJobs'
import '../App.css'

interface SwipeableJobCardProps {
  job: VideoJob
  isActive: boolean
  canApprove: boolean
  getStatusLabel: (status: VideoJob['status']) => string
  getStatusColor: (status: VideoJob['status']) => string
  showChannelName?: boolean
  onApprove?: (jobId: string, jobTitle?: string) => Promise<void>
  onReject?: (jobId: string) => Promise<void>
  onDelete?: (jobId: string) => Promise<void>
  loading?: boolean
  rejectingJobId?: string | null
}

export const SwipeableJobCard: React.FC<SwipeableJobCardProps> = ({
  job,
  isActive,
  canApprove,
  getStatusLabel,
  getStatusColor,
  showChannelName = false,
  onApprove,
  onReject,
  onDelete,
  loading = false,
  rejectingJobId = null,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number>(0)
  const currentXRef = useRef<number>(0)
  const isDraggingRef = useRef<boolean>(false)

  const SWIPE_THRESHOLD = 80 // Минимальное расстояние свайпа для показа кнопки удаления
  const MAX_SWIPE = 120 // Максимальное расстояние свайпа

  // Обработка начала касания/клика
  const handleStart = (clientX: number) => {
    startXRef.current = clientX
    currentXRef.current = clientX
    isDraggingRef.current = true
    setIsSwiping(true)
  }

  // Обработка движения
  const handleMove = (clientX: number) => {
    if (!isDraggingRef.current) return

    const deltaX = clientX - startXRef.current
    // Разрешаем только свайп влево (отрицательные значения)
    if (deltaX < 0) {
      const newOffset = Math.max(-MAX_SWIPE, deltaX)
      setSwipeOffset(newOffset)
      currentXRef.current = clientX
    }
  }

  // Обработка окончания касания/клика
  const handleEnd = () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsSwiping(false)

    // Если свайпнули достаточно далеко, показываем кнопку удаления
    if (swipeOffset <= -SWIPE_THRESHOLD) {
      setSwipeOffset(-MAX_SWIPE)
    } else {
      // Возвращаем карточку на место
      setSwipeOffset(0)
    }
  }

  // Touch события
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault() // Предотвращаем скролл при свайпе
    handleMove(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  // Mouse события (для десктопа, если нужно тестировать)
  const handleMouseDown = (e: React.MouseEvent) => {
    // На мобильных не используем mouse события
    if ('ontouchstart' in window) return
    handleStart(e.clientX)
  }

  // Обработка клика на кнопку удаления
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  // Подтверждение удаления
  const handleConfirmDelete = async () => {
    if (onDelete) {
      await onDelete(job.id)
    }
    setShowDeleteConfirm(false)
    setSwipeOffset(0)
  }

  // Отмена удаления
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false)
    setSwipeOffset(0)
  }

  // Закрытие свайпа при клике вне карточки
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        if (swipeOffset < 0) {
          setSwipeOffset(0)
        }
      }
    }

    if (swipeOffset < 0) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [swipeOffset])

  // Глобальные обработчики для mouse событий
  useEffect(() => {
    if (!isDraggingRef.current) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if ('ontouchstart' in window) return
      handleMove(e.clientX)
    }

    const handleGlobalMouseUp = () => {
      if ('ontouchstart' in window) return
      handleEnd()
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDraggingRef.current])

  return (
    <>
      <div className="swipeable-job-card-wrapper">
        <div
          ref={cardRef}
          className={`swipeable-job-card ${isSwiping ? 'swiping' : ''}`}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <div className={`job-card ${isActive ? 'job-card--active' : ''}`}>
            {/* Кнопка удаления для десктопа */}
            <button
              className="job-card__delete-desktop"
              onClick={handleDeleteClick}
              title="Удалить задачу"
              aria-label="Удалить задачу"
            >
              🗑️
            </button>

            <div className="job-card__header">
              <div className="job-card__info">
                <h4>
                  {job.videoTitle || job.prompt.substring(0, 60) + (job.prompt.length > 60 ? '...' : '')}
                </h4>
                {job.videoTitle && (
                  <p className="job-card__prompt">
                    {job.prompt.substring(0, 100) + (job.prompt.length > 100 ? '...' : '')}
                  </p>
                )}
                {showChannelName && job.channelName && (
                  <p style={{ fontSize: '0.875rem', color: '#718096', marginTop: '0.25rem' }}>
                    Канал: {job.channelName}
                  </p>
                )}
                <div className="job-card__status">
                  <span
                    className="job-card__status-dot"
                    style={{ background: getStatusColor(job.status) }}
                  />
                  <span style={{ color: getStatusColor(job.status) }}>
                    {getStatusLabel(job.status)}
                  </span>
                  {job.errorMessage && (
                    <span className="job-card__error">
                      {job.errorMessage}
                    </span>
                  )}
                </div>
              </div>
              <div className="job-card__timestamp">
                {new Date(job.createdAt).toLocaleString('ru-RU')}
              </div>
            </div>

            {/* Превью видео для готовых задач */}
            {job.status === 'ready' && job.previewUrl && (
              <div className="job-card__preview">
                <video
                  src={job.previewUrl}
                  controls
                  className="video-preview"
                />
              </div>
            )}

            {/* Действия для готовых задач */}
            {canApprove && onApprove && (
              <div className="job-card__actions">
                <button
                  className="button button-success"
                  onClick={() => onApprove(job.id, job.videoTitle)}
                  disabled={loading || job.status === 'uploaded'}
                >
                  ✅ Одобрить и отправить в Google Drive
                </button>
                {onReject && (
                  <button
                    className="button button-danger"
                    onClick={() => onReject(job.id)}
                    disabled={loading || rejectingJobId === job.id}
                    title={rejectingJobId === job.id ? 'Отклонение...' : 'Отклонить видео'}
                  >
                    {rejectingJobId === job.id ? '⏳ Отклонение...' : '🗑 Отклонить'}
                  </button>
                )}
              </div>
            )}

            {/* Ссылка на Google Drive для загруженных */}
            {job.status === 'uploaded' && job.webViewLink && (
              <div className="job-card__link">
                <a
                  href={job.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть в Google Drive
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Кнопка удаления при свайпе (мобильная) */}
        <div
          className="swipeable-job-card__delete-action"
          style={{
            opacity: swipeOffset < -SWIPE_THRESHOLD ? 1 : 0,
            transform: `translateX(${Math.max(0, swipeOffset + MAX_SWIPE)}px)`,
          }}
        >
          <button
            className="swipeable-job-card__delete-button"
            onClick={handleDeleteClick}
            aria-label="Удалить задачу"
          >
            Удалить
          </button>
        </div>
      </div>

      {/* Модалка подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Подтверждение удаления</h3>
            <p>Вы действительно хотите удалить эту генерацию? Действие необратимо.</p>
            <div className="modal-actions">
              <button className="button button-secondary" onClick={handleCancelDelete}>
                Отмена
              </button>
              <button className="button button-danger" onClick={handleConfirmDelete}>
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

