import React, { useState } from 'react'
import { useVideoJobs } from '../hooks/useVideoJobs'
import { VideoJobsList } from '../components/VideoJobsList'
import { apiFetch } from '../lib/apiClient'
import { useToast } from '../hooks/useToast'
import '../App.css'

const VideoJobsHistory: React.FC = () => {
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null)
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null)
  const toast = useToast()
  
  // Загружаем все задачи (без фильтра по каналу)
  const {
    videoJobs,
    activeJobsCount,
    maxActiveJobs,
    loading,
    error,
    refreshJobs,
    removeJob,
  } = useVideoJobs({
    channelId: null, // null означает загрузить все задачи
    autoPoll: true,
    pollInterval: 3000,
  })

  const handleApproveJob = async (jobId: string, jobTitle?: string) => {
    const job = videoJobs.find(j => j.id === jobId)
    if (!job) {
      toast.error('Задача не найдена')
      return
    }

    // Проверяем, что задача в статусе ready
    if (job.status !== 'ready') {
      toast.error('Можно одобрить только готовые видео')
      return
    }

    setApprovingJobId(jobId)
    
    try {
      console.log('[Approve] Starting approval for job:', jobId, 'title:', jobTitle)
      
      const response = await apiFetch(`/api/video-jobs/${jobId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: jobTitle?.trim() || undefined,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Ошибка ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Approve] Job approved successfully:', result)
      
      toast.success('Видео успешно загружено в Google Drive!')
      
      // Обновляем список для отображения нового статуса
      // Polling обновит автоматически, но делаем сразу для быстрого отклика
      await refreshJobs()
    } catch (err: any) {
      console.error('[Approve] Error approving job:', err)
      toast.error(err.message || 'Ошибка при одобрении видео')
    } finally {
      setApprovingJobId(null)
    }
  }

  const handleRejectJob = async (jobId: string) => {
    const job = videoJobs.find(j => j.id === jobId)
    if (!job) {
      toast.error('Задача не найдена')
      return
    }

    const jobName = job.videoTitle || job.prompt.substring(0, 50) || 'это видео'
    
    if (!window.confirm(`Вы уверены, что хотите отклонить "${jobName}"? Это действие нельзя отменить.`)) {
      return
    }
    
    setRejectingJobId(jobId)
    
    try {
      console.log('[Reject] Starting rejection for job:', jobId)
      
      // Оптимистичное обновление: сразу убираем из списка
      removeJob(jobId)
      
      const response = await apiFetch(`/api/video-jobs/${jobId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        // Если отклонение не удалось, восстанавливаем список
        await refreshJobs()
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Ошибка ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Reject] Job rejected successfully:', result)
      
      toast.success('Видео отклонено и удалено')
      
      // Не вызываем refreshJobs() здесь, так как:
      // 1. Оптимистичное обновление уже применено через removeJob()
      // 2. Автоматический polling обновит список через несколько секунд
    } catch (err: any) {
      console.error('[Reject] Error rejecting job:', err)
      // Восстанавливаем список в случае ошибки
      await refreshJobs()
      toast.error(err.message || 'Ошибка при отклонении видео')
    } finally {
      setRejectingJobId(null)
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      console.log('[Delete] Starting deletion of job:', jobId)
      
      // Оптимистичное обновление: сразу убираем из списка
      removeJob(jobId)
      
      const response = await apiFetch(`/api/video-jobs/${jobId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        // Если удаление не удалось, обновляем список заново
        await refreshJobs()
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || `Ошибка ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Delete] Job deleted successfully:', result)
      
      toast.success('Задача удалена')
      
      // Не вызываем refreshJobs() здесь, так как:
      // 1. Оптимистичное обновление уже применено через removeJob()
      // 2. Автоматический polling обновит список через несколько секунд
      // Это предотвращает множественные одновременные запросы
    } catch (err: any) {
      console.error('[Delete] Error deleting job:', err)
      // Восстанавливаем список в случае ошибки
      await refreshJobs()
      toast.error(err.message || 'Не удалось удалить задачу')
    }
  }

  return (
    <div className="card">
      <h2>История генераций</h2>
      
      {error && (
        <div className="error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      <VideoJobsList
        jobs={videoJobs}
        activeJobsCount={activeJobsCount}
        maxActiveJobs={maxActiveJobs}
        loading={loading}
        onApprove={handleApproveJob}
        onReject={handleRejectJob}
        onDelete={handleDeleteJob}
        rejectingJobId={rejectingJobId}
        approvingJobId={approvingJobId}
        showChannelName={true}
      />
    </div>
  )
}

export default VideoJobsHistory

