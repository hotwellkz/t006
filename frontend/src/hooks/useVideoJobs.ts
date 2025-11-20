import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetchJson, ApiError, resolveApiUrl } from '../lib/apiClient'
import { useNotifications } from './useNotifications'

export type VideoJobStatus = 
  | "queued"
  | "sending"
  | "waiting_video"
  | "downloading"
  | "ready"
  | "uploading"
  | "uploaded"
  | "rejected"
  | "error"

export interface VideoJob {
  id: string
  prompt: string
  channelId?: string
  channelName?: string
  videoTitle?: string
  status: VideoJobStatus
  errorMessage?: string
  createdAt: number
  updatedAt: number
  previewUrl?: string
  driveFileId?: string
  webViewLink?: string
  webContentLink?: string
}

interface UseVideoJobsOptions {
  channelId?: string | null
  autoPoll?: boolean
  pollInterval?: number
  onJobStatusChange?: (jobId: string, oldStatus: VideoJobStatus, newStatus: VideoJobStatus) => void
}

export function useVideoJobs(options: UseVideoJobsOptions = {}) {
  const { channelId, autoPoll = false, pollInterval = 3000, onJobStatusChange } = options
  
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([])
  const [activeJobsCount, setActiveJobsCount] = useState(0)
  const [maxActiveJobs, setMaxActiveJobs] = useState(2)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const previousJobsRef = useRef<Map<string, VideoJobStatus>>(new Map())
  const notifications = useNotifications()

  const fetchVideoJobs = useCallback(async () => {
    // Если channelId === undefined, не загружаем (хук не инициализирован)
    // Если channelId === null, загружаем все задачи
    // Если channelId === string, загружаем задачи конкретного канала
    if (channelId === undefined) {
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (channelId !== null) {
        // Если channelId не null, добавляем его в параметры
        params.append('channelId', channelId)
      }
      // Если channelId === null, params будет пустым, и бэкенд вернет все задачи

      const url = params.toString() 
        ? `/api/video-jobs?${params.toString()}`
        : '/api/video-jobs'
      
      const data = await apiFetchJson<{
        jobs?: VideoJob[]
        activeCount?: number
        maxActiveJobs?: number
      }>(url)

      const normalizedJobs = (data.jobs || []).map((job) => ({
        ...job,
        previewUrl: job.previewUrl ? resolveApiUrl(job.previewUrl) : undefined,
      }))

      // Отслеживаем изменения статусов для уведомлений
      const previousJobs = previousJobsRef.current
      normalizedJobs.forEach((job) => {
        const previousStatus = previousJobs.get(job.id)
        const currentStatus = job.status
        
        // Если статус изменился с "не ready" на "ready", отправляем уведомление
        if (
          previousStatus &&
          previousStatus !== 'ready' &&
          currentStatus === 'ready' &&
          (previousStatus === 'waiting_video' || 
           previousStatus === 'downloading' || 
           previousStatus === 'sending' ||
           previousStatus === 'queued')
        ) {
          const jobTitle = job.videoTitle || job.prompt.substring(0, 60) + (job.prompt.length > 60 ? '...' : '')
          notifications.notifyVideoReady(jobTitle, job.id)
          
          // Вызываем callback если передан
          if (onJobStatusChange) {
            onJobStatusChange(job.id, previousStatus, currentStatus)
          }
        } else if (previousStatus && previousStatus !== currentStatus && onJobStatusChange) {
          // Вызываем callback для любых изменений статуса
          onJobStatusChange(job.id, previousStatus, currentStatus)
        }
        
        // Обновляем предыдущий статус
        previousJobs.set(job.id, currentStatus)
      })

      setVideoJobs(normalizedJobs)
      setActiveJobsCount(data.activeCount ?? 0)
      if (typeof data.maxActiveJobs === 'number') {
        setMaxActiveJobs(data.maxActiveJobs)
      }
      setError('')
    } catch (err) {
      console.error('[VideoJobs] Error fetching jobs:', err)
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Ошибка загрузки задач')
      }
    } finally {
      setLoading(false)
    }
  }, [channelId, notifications, onJobStatusChange])

  // Автоматический polling
  useEffect(() => {
    if (autoPoll && channelId !== undefined) {
      fetchVideoJobs()
      pollingIntervalRef.current = setInterval(() => {
        fetchVideoJobs()
      }, pollInterval)
    } else {
      // Загружаем один раз при монтировании, если autoPoll выключен
      if (channelId !== undefined) {
        fetchVideoJobs()
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [autoPoll, channelId, pollInterval, fetchVideoJobs])

  const refreshJobs = useCallback(() => {
    return fetchVideoJobs()
  }, [fetchVideoJobs])

  return {
    videoJobs,
    activeJobsCount,
    maxActiveJobs,
    loading,
    error,
    refreshJobs,
  }
}

