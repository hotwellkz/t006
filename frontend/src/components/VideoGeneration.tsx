import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import { apiFetch, apiFetchJson, ApiError, resolveApiUrl } from '../lib/apiClient'
import { useNotifications } from '../hooks/useNotifications'
import { useToast } from '../hooks/useToast'
import { ToastContainer } from './Toast'
import { VideoJobsList } from './VideoJobsList'

type Language = 'ru' | 'kk' | 'en'

interface Channel {
  id: string
  name: string
  description: string
  language: Language
  durationSeconds: number
  ideaPromptTemplate: string
  videoPromptTemplate: string
  gdriveFolderId?: string | null
}

interface Idea {
  id: string
  title: string
  description: string
}

type VideoJobStatus = 
  | "queued"
  | "sending"
  | "waiting_video"
  | "downloading"
  | "ready"
  | "uploading"
  | "uploaded"
  | "rejected"
  | "error"

interface VideoJob {
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

type Step = 1 | 2 | 3

// Компонент для collapsible настроек уведомлений
const NotificationSettingsCollapsible: React.FC<{ notifications: ReturnType<typeof useNotifications> }> = ({ notifications }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="notification-settings-collapsible">
      <button
        className="notification-settings-collapsible__header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>🔔 Настройки уведомлений</span>
        <span className="notification-settings-collapsible__arrow">
          {isOpen ? '▼' : '▶'}
        </span>
      </button>
      {isOpen && (
        <div className="notification-settings-collapsible__content">
          <label className="notification-settings-collapsible__checkbox">
            <input
              type="checkbox"
              checked={notifications.settings.soundEnabled}
              onChange={(e) => {
                notifications.setSoundEnabled(e.target.checked)
              }}
            />
            <span>🔊 Звуковые уведомления</span>
          </label>
          <label className="notification-settings-collapsible__checkbox">
            <input
              type="checkbox"
              checked={notifications.settings.browserEnabled}
              onChange={async (e) => {
                if (e.target.checked) {
                  const granted = await notifications.setBrowserEnabled(true)
                  if (!granted) {
                    alert('Разрешение на уведомления не предоставлено. Проверьте настройки браузера.')
                    e.target.checked = false
                  }
                } else {
                  notifications.setBrowserEnabled(false)
                }
              }}
            />
            <span>
              📱 Браузерные уведомления
              {notifications.settings.browserEnabled && notifications.settings.permissionGranted && (
                <span className="notification-settings-collapsible__status">✓ Включены</span>
              )}
              {notifications.settings.browserEnabled && !notifications.settings.permissionGranted && (
                <span className="notification-settings-collapsible__status notification-settings-collapsible__status--error">⚠ Разрешение не предоставлено</span>
              )}
            </span>
          </label>
          <label className="notification-settings-collapsible__checkbox">
            <input
              type="checkbox"
              checked={notifications.settings.pushEnabled}
              onChange={async (e) => {
                const success = await notifications.setPushEnabled(e.target.checked)
                if (!success && e.target.checked) {
                  e.target.checked = false
                }
              }}
            />
            <span>
              🔔 Push-уведомления (даже при закрытой вкладке)
              {notifications.settings.pushEnabled && notifications.settings.fcmTokenRegistered && (
                <span className="notification-settings-collapsible__status">✓ Активны</span>
              )}
              {notifications.settings.pushEnabled && !notifications.settings.fcmTokenRegistered && (
                <span className="notification-settings-collapsible__status notification-settings-collapsible__status--error">⚠ Ошибка регистрации</span>
              )}
            </span>
          </label>
        </div>
      )}
    </div>
  )
}

const VideoGeneration: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelsError, setChannelsError] = useState<string>('')
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [theme, setTheme] = useState<string>('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null)
  // Автосохранение промпта и названия в localStorage
  const [veoPrompt, setVeoPrompt] = useState<string>(() => {
    try {
      return localStorage.getItem('veoPrompt') || ''
    } catch {
      return ''
    }
  })
  const [videoTitle, setVideoTitle] = useState<string>(() => {
    try {
      return localStorage.getItem('videoTitle') || ''
    } catch {
      return ''
    }
  })
  
  // Автосохранение в localStorage при изменении
  useEffect(() => {
    try {
      localStorage.setItem('veoPrompt', veoPrompt)
    } catch {}
  }, [veoPrompt])
  
  useEffect(() => {
    try {
      localStorage.setItem('videoTitle', videoTitle)
    } catch {}
  }, [videoTitle])
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([])
  const [activeJobsCount, setActiveJobsCount] = useState(0)
  const [maxActiveJobs, setMaxActiveJobs] = useState(2)
  const [loading, setLoading] = useState(false)
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [generatingTitle, setGeneratingTitle] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [lastAutoGeneratedTitle, setLastAutoGeneratedTitle] = useState<string>('') // Для отслеживания автогенерированного названия
  const [jobCreationInfo, setJobCreationInfo] = useState<{ id: string; title?: string } | null>(null)
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null) // ID задачи, которая сейчас отклоняется
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null) // ID задачи, которая сейчас одобряется
  
  // Состояния для модалки голосового ввода
  // Теперь используем MediaRecorder + OpenAI Whisper на backend вместо браузерного SpeechRecognition
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [voiceIdeaText, setVoiceIdeaText] = useState<string>('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingError, setRecordingError] = useState<string>('')
  
  // Используем useRef для хранения MediaRecorder и аудио потока
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioStreamRef = useRef<MediaStream | null>(null)
  
  // Состояния для модалки "Вставить готовый промпт"
  const [showCustomPromptModal, setShowCustomPromptModal] = useState(false)
  const [customPromptText, setCustomPromptText] = useState<string>('')

  // Polling для обновления статусов задач
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // Хук для уведомлений
  const notifications = useNotifications()
  
  // Хук для Toast-уведомлений
  const toast = useToast()

  // Универсальная функция для копирования текста в буфер обмена
  const copyToClipboard = async (text: string): Promise<boolean> => {
    if (!text || !text.trim()) {
      return false
    }

    try {
      // Проверяем поддержку Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      } else {
        // Fallback для старых браузеров
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        try {
          const success = document.execCommand('copy')
          document.body.removeChild(textArea)
          return success
        } catch (err) {
          document.body.removeChild(textArea)
          return false
        }
      }
    } catch (error) {
      console.error('Ошибка при копировании:', error)
      return false
    }
  }

  // Функция для копирования названия ролика в буфер обмена
  const handleCopyTitle = async () => {
    const titleToCopy = videoTitle?.trim() || ''
    
    if (!titleToCopy) {
      toast.info('Название пока пустое')
      return
    }

    const success = await copyToClipboard(titleToCopy)
    if (success) {
      toast.success('Название ролика скопировано')
    } else {
      toast.error('Не удалось скопировать. Скопируйте вручную.')
    }
  }

  // Функция для копирования промпта в буфер обмена
  const handleCopyPrompt = async () => {
    const promptToCopy = veoPrompt?.trim() || ''
    
    if (!promptToCopy) {
      toast.info('Промпт пока пустой')
      return
    }

    const success = await copyToClipboard(promptToCopy)
    if (success) {
      toast.success('Промпт скопирован')
    } else {
      toast.error('Не удалось скопировать. Скопируйте вручную.')
    }
  }

  // Функция для навигации назад
  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      // Если нет истории, переходим на главную
      navigate('/')
    }
  }

  // Функция для перехода на главную
  const handleGoHome = () => {
    navigate('/')
  }
  
  // Храним предыдущее состояние задач для отслеживания изменений статусов
  const previousJobsRef = useRef<Map<string, VideoJobStatus>>(new Map())
  

  useEffect(() => {
    fetchChannels()
    
    // Cleanup при размонтировании - останавливаем запись и освобождаем ресурсы
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
        audioStreamRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (step !== 3) {
      setJobCreationInfo(null)
    }
  }, [step])

  // Polling для обновления списка задач, когда выбран канал
  useEffect(() => {
    if (selectedChannel?.id) {
      fetchVideoJobs()
      // Запускаем polling каждые 3 секунды
      pollingIntervalRef.current = setInterval(() => {
        fetchVideoJobs()
      }, 3000)
    } else {
      // Останавливаем polling, если канал не выбран
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel?.id]) // fetchVideoJobs использует notifications через ref, поэтому не добавляем в зависимости

  const getConnectivityErrorMessage = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.isNetworkError || !err.status || err.status >= 500 || err.status === 404) {
        return 'Не удалось подключиться к серверу. Проверьте настройки backend API.'
      }
      return err.message
    }
    if (err instanceof Error) {
      return err.message
    }
    return 'Неизвестная ошибка'
  }

  const fetchChannels = async () => {
    setChannelsLoading(true)
    setChannelsError('')
    try {
      const data = await apiFetchJson<Channel[]>('/api/channels')
      setChannels(data)
    } catch (err) {
      console.error('[channels] load error', err)
      setChannelsError(getConnectivityErrorMessage(err))
    } finally {
      setChannelsLoading(false)
    }
  }

  const fetchVideoJobs = async () => {
    if (!selectedChannel?.id) return

    try {
      const params = new URLSearchParams({ channelId: selectedChannel.id })
      const data = await apiFetchJson<{
        jobs?: VideoJob[]
        activeCount?: number
        maxActiveJobs?: number
      }>(`/api/video-jobs?${params.toString()}`)

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
        }
        
        // Обновляем предыдущий статус
        previousJobs.set(job.id, currentStatus)
      })

      setVideoJobs(normalizedJobs)
      setActiveJobsCount(data.activeCount ?? 0)
      if (typeof data.maxActiveJobs === 'number') {
        setMaxActiveJobs(data.maxActiveJobs)
      }
    } catch (err) {
      console.error('[VideoJobs] Error fetching jobs:', err)
    }
  }

  const handleChannelSelect = (channelId: string) => {
    const channel = channels.find((c) => c.id === channelId)
    if (channel) {
      setSelectedChannel(channel)
      setStep(2)
      setError('')
      setSuccess('')
      setJobCreationInfo(null)
    }
  }

  const handleGenerateIdeas = async () => {
    if (!selectedChannel) {
      setError('Выберите канал')
      return
    }

    setGeneratingIdeas(true)
    setError('')
    setSuccess('')
    setIdeas([])

    try {
      const data = await apiFetchJson<{ ideas: Idea[] }>('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          theme: theme.trim() || null,
          count: 5,
        }),
      })
      setIdeas(data.ideas)
      setSuccess(`Сгенерировано ${data.ideas.length} идей`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingIdeas(false)
    }
  }

  const handleSelectIdea = async (idea: Idea) => {
    setSelectedIdea(idea)
    setGeneratingPrompt(true)
    setError('')
    setSuccess('')

    try {
      const data = await apiFetchJson<{ veoPrompt: string; videoTitle: string }>('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel!.id,
          idea: {
            title: idea.title,
            description: idea.description,
          },
        }),
      })
      setVeoPrompt(data.veoPrompt)
      setVideoTitle(data.videoTitle)
      setStep(3)
      setSuccess('Промпт и название сгенерированы!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const handleRegeneratePrompt = async () => {
    // Можно регенерировать промпт только если есть выбранная идея
    if (!selectedIdea || !selectedChannel) {
      setError('Нет выбранной идеи для регенерации промпта')
      return
    }

    setGeneratingPrompt(true)
    setError('')
    setSuccess('')

    try {
      const data = await apiFetchJson<{ veoPrompt: string; videoTitle: string }>('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          idea: {
            title: selectedIdea.title,
            description: selectedIdea.description,
          },
        }),
      })
      setVeoPrompt(data.veoPrompt)
      setVideoTitle(data.videoTitle)
      setSuccess('Промпт и название перегенерированы!')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingPrompt(false)
    }
  }

  // Обработчики для голосового ввода через MediaRecorder + OpenAI Whisper
  const handleStartVoiceInput = () => {
    if (!selectedChannel) return
    
    setShowVoiceModal(true)
    setVoiceIdeaText('')
    setRecordingError('')
    setIsRecording(false)
    setIsTranscribing(false)
  }

  const handleCloseVoiceModal = () => {
    // Останавливаем запись, если она идет
    if (isRecording && mediaRecorderRef.current) {
      console.log('[voice] Stopping recording on modal close')
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      } catch (e) {
        console.error('[voice] Error stopping recording:', e)
      }
    }
    
    // Освобождаем аудио поток
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    
    setShowVoiceModal(false)
    setVoiceIdeaText('')
    setRecordingError('')
    setIsRecording(false)
    setIsTranscribing(false)
    audioChunksRef.current = []
  }

  const handleToggleRecording = async () => {
    if (isRecording) {
      // Останавливаем запись
      console.log('[voice] Stopping recording')
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      setIsRecording(false)
    } else {
      // Начинаем запись
      console.log('[voice] Starting recording')
      setRecordingError('')
      
      try {
        // Запрашиваем доступ к микрофону
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStreamRef.current = stream
        
        // Создаем MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : MediaRecorder.isTypeSupported('audio/ogg') 
          ? 'audio/ogg' 
          : 'audio/mp4'
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
        })
        
        audioChunksRef.current = []
        
        // Обработчик данных
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
            console.log('[voice] Audio chunk received, size:', event.data.size)
          }
        }
        
        // Обработчик остановки
        mediaRecorder.onstop = async () => {
          console.log('[voice] Recording stopped, chunks:', audioChunksRef.current.length)
          
          // Освобождаем поток
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach(track => track.stop())
            audioStreamRef.current = null
          }
          
          // Создаем Blob из записанных чанков
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          console.log('[voice] Audio blob created, size:', audioBlob.size, 'bytes')
          
          // Отправляем на сервер для транскрипции
          await uploadAudioForTranscription(audioBlob, mimeType)
          
          // Очищаем чанки
          audioChunksRef.current = []
        }
        
        // Обработчик ошибок
        mediaRecorder.onerror = (event: any) => {
          console.error('[voice] MediaRecorder error:', event.error)
          setRecordingError('Ошибка записи. Попробуйте ещё раз.')
          setIsRecording(false)
        }
        
        mediaRecorderRef.current = mediaRecorder
        
        // Начинаем запись
        mediaRecorder.start()
        setIsRecording(true)
        console.log('[voice] Recording started')
      } catch (error: any) {
        console.error('[voice] Error accessing microphone:', error)
        setIsRecording(false)
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setRecordingError('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера.')
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setRecordingError('Микрофон не найден. Убедитесь, что микрофон подключен.')
        } else {
          setRecordingError('Не удалось начать запись. Попробуйте ещё раз или введите текст вручную.')
        }
      }
    }
  }

  const uploadAudioForTranscription = async (audioBlob: Blob, mimeType: string) => {
    setIsTranscribing(true)
    setRecordingError('')
    
    try {
      console.log('[voice] Uploading audio for transcription, size:', audioBlob.size)
      
      // Создаем FormData
      const formData = new FormData()
      const fileName = `idea_${Date.now()}.${mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'mp4'}`
      formData.append('file', audioBlob, fileName)
      
      // Отправляем на backend
      const data = await apiFetchJson<{ text: string }>('/api/transcribe-idea', {
        method: 'POST',
        body: formData,
      })
      const transcribedText = data.text || ''
      
      console.log('[voice] Transcription received:', transcribedText.substring(0, 100))
      
      if (transcribedText.trim()) {
        // Добавляем текст к существующему или заменяем, если пусто
        setVoiceIdeaText((prev) => {
          const newText = prev && prev.length > 0 
            ? `${prev}\n${transcribedText.trim()}` 
            : transcribedText.trim()
          return newText
        })
      } else {
        setRecordingError('Не удалось распознать речь. Попробуйте ещё раз или введите текст вручную.')
      }
    } catch (error: any) {
      console.error('[voice] Transcription error:', error)
      setRecordingError(error.message || 'Ошибка при транскрипции. Попробуйте ещё раз или введите текст вручную.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleClearVoiceText = () => {
    setVoiceIdeaText('')
    setRecordingError('')
  }

  const handleGeneratePromptFromVoice = async () => {
    if (!voiceIdeaText.trim() || !selectedChannel) return

    setGeneratingPrompt(true)
    setRecordingError('')

    try {
      // Формируем объект idea из текста пользователя
      const ideaTitle = voiceIdeaText.length > 80 
        ? voiceIdeaText.substring(0, 80) + '...' 
        : voiceIdeaText
      
      const data = await apiFetchJson<{ veoPrompt: string; videoTitle: string }>('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          idea: {
            title: `Идея пользователя: ${ideaTitle}`,
            description: voiceIdeaText.trim(),
          },
        }),
      })
      setVeoPrompt(data.veoPrompt)
      setVideoTitle(data.videoTitle)
      
      // Сохраняем пользовательскую идею для отображения на шаге 3
      setSelectedIdea({
        id: `user_idea_${Date.now()}`,
        title: `Идея пользователя: ${ideaTitle}`,
        description: voiceIdeaText.trim(),
      })
      
      // Закрываем модалку и переходим на шаг 3
      handleCloseVoiceModal()
      setStep(3)
      setSuccess('Промпт и название сгенерированы!')
    } catch (err: any) {
      setRecordingError('Не удалось сгенерировать промпт по этой идее. Попробуйте ещё раз или отредактируйте текст.')
      setError(err.message)
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!veoPrompt.trim()) {
      setError('Введите промпт для генерации видео')
      return
    }

    if (!selectedChannel) {
      setError('Выберите канал')
      return
    }

    // Проверяем лимит активных задач
    if (activeJobsCount >= maxActiveJobs) {
      setError(`Уже генерируются ${maxActiveJobs} видео. Подождите, пока одно завершится.`)
      return
    }

    // При первом клике на генерацию инициализируем аудио (если звук включен)
    if (notifications.settings.soundEnabled) {
      // Это активирует аудио контекст после пользовательского действия
      notifications.setSoundEnabled(true)
    }

    setLoading(true)
    setError('')
    setSuccess('')

    // Если поле "Название ролика" пустое, запускаем параллельную генерацию названия
    const shouldGenerateTitle = !videoTitle || videoTitle.trim().length === 0
    let finalTitle = videoTitle

    if (shouldGenerateTitle && selectedChannel) {
      console.log('[Title] Starting parallel title generation')
      setGeneratingTitle(true)
      
      try {
        const titleData = await apiFetchJson<{ title?: string }>('/api/generate-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: veoPrompt.trim(),
            channelName: selectedChannel.name,
            language: selectedChannel.language,
          }),
        })

        const generatedTitle = titleData.title?.trim()
        
        if (generatedTitle) {
          console.log('[Title] Generated title:', generatedTitle)
          finalTitle = generatedTitle
          setVideoTitle(generatedTitle)
          setLastAutoGeneratedTitle(generatedTitle)
        }
      } catch (err: any) {
        console.error('[Title] Error generating title:', err)
      } finally {
        setGeneratingTitle(false)
      }
    }

    try {
      const data = await apiFetchJson<{ jobId: string; status: string; maxActiveJobs?: number }>('/api/video-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: veoPrompt.trim(),
          channelId: selectedChannel.id,
          channelName: selectedChannel.name,
          ideaText: selectedIdea ? `${selectedIdea.title}. ${selectedIdea.description}` : undefined,
          videoTitle: finalTitle || undefined,
        }),
      })
      console.log('[VideoJob] Created job:', data.jobId)
      
      const trimmedPrompt = veoPrompt.trim()
      const newJobTitle =
        (finalTitle && finalTitle.trim()) ||
        (trimmedPrompt ? `${trimmedPrompt.substring(0, 60)}${trimmedPrompt.length > 60 ? '...' : ''}` : undefined)

      setJobCreationInfo({
        id: data.jobId,
        title: newJobTitle,
      })
      
      // НЕ очищаем промпт и название - оставляем для повторного использования
      // Пользователь может отредактировать и сгенерировать ещё раз
      // setVeoPrompt('') - УБРАНО
      // setVideoTitle('') - УБРАНО
      setLastAutoGeneratedTitle('')
      // setSelectedIdea(null) - УБРАНО, чтобы можно было регенерировать промпт
      
      // Обновляем список задач
      await fetchVideoJobs()
      
      // Показываем успешное сообщение
      toast.success('Задача создана! Видео генерируется...')
      setSuccess('')
    } catch (err: any) {
      if (err instanceof ApiError && err.message === 'MAX_ACTIVE_JOBS_REACHED') {
        setError(`Уже генерируются ${maxActiveJobs} видео. Подождите, пока одно завершится.`)
        await fetchVideoJobs()
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

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
    setError('')
    setSuccess('')

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
      setSuccess('')
      
      // Обновляем список задач для отображения нового статуса
      await fetchVideoJobs()
    } catch (err: any) {
      console.error('[Approve] Error approving job:', err)
      toast.error(err.message || 'Ошибка при одобрении видео')
      setError(err.message)
    } finally {
      setApprovingJobId(null)
    }
  }

  const handleRejectJob = async (jobId: string) => {
    // Подтверждение перед отклонением
    const job = videoJobs.find(j => j.id === jobId)
    const jobName = job?.videoTitle || job?.prompt.substring(0, 50) || 'это видео'
    
    if (!window.confirm(`Вы уверены, что хотите отклонить "${jobName}"? Это действие нельзя отменить.`)) {
      return
    }
    
    // Блокируем кнопку для этой конкретной задачи
    setRejectingJobId(jobId)
    setError('')
    setSuccess('')
    
    try {
      console.log(`[VideoJob] Rejecting job ${jobId}`)
      const response = await apiFetch(`/api/video-jobs/${jobId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.message || `Ошибка ${response.status}`)
      }
      
      const result = await response.json()
      console.log(`[VideoJob] Job ${jobId} rejected successfully:`, result)
      
      toast.success('Видео отклонено')
      setSuccess('')
      
      // Обновляем список задач
      await fetchVideoJobs()
    } catch (err: any) {
      console.error(`[VideoJob] Error rejecting job ${jobId}:`, err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      // Более информативное сообщение об ошибке
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError('Задача не найдена. Возможно, она уже была удалена.')
        } else if (err.status === 500) {
          setError('Ошибка сервера при отклонении видео. Попробуйте ещё раз.')
        } else {
          setError(err.message || 'Ошибка при отклонении видео')
        }
      } else {
        setError(errorMessage || 'Ошибка при отклонении видео')
      }
    } finally {
      setRejectingJobId(null)
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      console.log('[Delete] Starting deletion of job:', jobId)
      
      // Оптимистичное обновление: сразу убираем из списка
      setVideoJobs((prev) => {
        const filtered = prev.filter((job) => job.id !== jobId)
        // Пересчитываем активные задачи
        const removedJob = prev.find((j) => j.id === jobId)
        if (removedJob && ['queued', 'sending', 'waiting_video', 'downloading', 'uploading'].includes(removedJob.status)) {
          setActiveJobsCount((current) => Math.max(0, current - 1))
        }
        return filtered
      })
      
      const response = await apiFetch(`/api/video-jobs/${jobId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        // Если удаление не удалось, обновляем список заново
        await fetchVideoJobs()
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || errorData.error || `Ошибка ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Delete] Job deleted successfully:', result)
      
      toast.success('Задача удалена')
      
      // Не вызываем fetchVideoJobs() здесь, так как:
      // 1. Оптимистичное обновление уже применено через setVideoJobs()
      // 2. Автоматический polling обновит список через несколько секунд
      // Это предотвращает множественные одновременные запросы
    } catch (err: any) {
      console.error(`[VideoJob] Error deleting job ${jobId}:`, err)
      // Восстанавливаем список в случае ошибки
      await fetchVideoJobs()
      toast.error(err.message || 'Не удалось удалить задачу')
    }
  }


  // Повторная генерация с тем же промптом
  const handleRegenerateVideo = async () => {
    if (!veoPrompt.trim()) {
      setError('Нет промпта для генерации')
      return
    }

    if (!selectedChannel) {
      setError('Выберите канал')
      return
    }

    // Проверяем лимит активных задач
    if (activeJobsCount >= maxActiveJobs) {
      setError(`Уже генерируются ${maxActiveJobs} видео. Подождите, пока одно завершится.`)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    // Используем текущий промпт и название (если есть)
    const finalTitle = videoTitle?.trim() || undefined

    try {
      const data = await apiFetchJson<{ jobId: string; status: string }>('/api/video-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: veoPrompt.trim(),
          channelId: selectedChannel.id,
          channelName: selectedChannel.name,
          ideaText: selectedIdea ? `${selectedIdea.title}. ${selectedIdea.description}` : undefined,
          videoTitle: finalTitle,
        }),
      })
      
      console.log('[VideoJob] Created new job for regeneration:', data.jobId)
      
      const trimmedPrompt = veoPrompt.trim()
      const newJobTitle =
        (finalTitle && finalTitle.trim()) ||
        (trimmedPrompt ? `${trimmedPrompt.substring(0, 60)}${trimmedPrompt.length > 60 ? '...' : ''}` : undefined)

      setJobCreationInfo({
        id: data.jobId,
        title: newJobTitle,
      })
      
      // НЕ очищаем промпт и название - они остаются для дальнейшего использования
      
      // Обновляем список задач
      await fetchVideoJobs()
      
      // Показываем успешное сообщение
      setSuccess('Новая задача создана! Видео генерируется...')
    } catch (err: any) {
      if (err instanceof ApiError && err.message === 'MAX_ACTIVE_JOBS_REACHED') {
        setError(`Уже генерируются ${maxActiveJobs} видео. Подождите, пока одно завершится.`)
        await fetchVideoJobs()
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="card">
      <h2>Генерация видео</h2>

      {/* Индикатор шагов */}
      <div className="step-indicator" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center' }}>
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="step-number" style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: step >= 1 ? '#667eea' : '#e2e8f0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</div>
          <span>Выбор канала</span>
        </div>
        <div style={{ width: '2rem', height: '2px', background: step >= 2 ? '#667eea' : '#e2e8f0', marginTop: '1rem' }}></div>
        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="step-number" style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: step >= 2 ? '#667eea' : '#e2e8f0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
          <span>Генерация идей</span>
        </div>
        <div style={{ width: '2rem', height: '2px', background: step >= 3 ? '#667eea' : '#e2e8f0', marginTop: '1rem' }}></div>
        <div className={`step ${step >= 3 ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="step-number" style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: step >= 3 ? '#667eea' : '#e2e8f0', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</div>
          <span>Промпт + генерация</span>
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Шаг 1: Выбор канала */}
      {step === 1 && (
        <div>
          <div className="input-group">
            <label>Выберите канал</label>
            {channelsLoading && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ 
                      padding: '1rem', 
                      border: '2px solid #e2e8f0', 
                      borderRadius: '10px',
                      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'loading 1.5s ease-in-out infinite',
                      height: '120px'
                    }}></div>
                  ))}
                </div>
              </div>
            )}
            {channelsError && (
              <div
                className="error"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}
              >
                <span>{channelsError}</span>
                <button
                  className="button button-secondary"
                  onClick={fetchChannels}
                  disabled={channelsLoading}
                  style={{ flexShrink: 0 }}
                >
                  {channelsLoading ? 'Повторяем...' : 'Повторить'}
                </button>
              </div>
            )}
            <div className="channel-grid">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="channel-card"
                  onClick={() => handleChannelSelect(channel.id)}
                >
                  <h3 className="channel-card__title">{channel.name}</h3>
                  {channel.description && (
                    <p className="channel-card__description">
                      {channel.description}
                    </p>
                  )}
                  <div className="channel-card__meta">
                    {channel.language.toUpperCase()} • {channel.durationSeconds}с
                  </div>
                </div>
              ))}
            </div>
            {channels.length === 0 && !channelsLoading && !channelsError && (
              <p style={{ color: '#a0aec0', marginTop: '0.5rem' }}>Каналы не найдены</p>
            )}
          </div>
        </div>
      )}

      {/* Шаг 2: Генерация идей */}
      {step === 2 && selectedChannel && (
        <div>
          <button
            className="button button-secondary"
            onClick={() => {
              setStep(1)
              setSelectedChannel(null)
              setIdeas([])
              setSelectedIdea(null)
            }}
            style={{ marginBottom: '1rem' }}
          >
            ← Назад
          </button>

          <div style={{ background: '#f7fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{selectedChannel.name}</h3>
            {selectedChannel.description && (
              <p style={{ margin: '0 0 0.5rem 0', color: '#718096' }}>{selectedChannel.description}</p>
            )}
            <div style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
              Язык: {selectedChannel.language.toUpperCase()} • Длительность: {selectedChannel.durationSeconds}с
            </div>
          </div>

          <div className="input-group">
            <label>Дополнительная тема (необязательно)</label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Например: про новый год, про технологии..."
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button
              className="button"
              onClick={handleStartVoiceInput}
              disabled={generatingIdeas || generatingPrompt}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>🎤</span>
              <span>Предложить свою идею</span>
            </button>
            <button
              className="button"
              onClick={handleGenerateIdeas}
              disabled={generatingIdeas || generatingPrompt}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>✨</span>
              <span>Сгенерировать идеи</span>
            </button>
            <button
              className="button"
              onClick={() => {
                console.log('[customPrompt] open modal')
                setShowCustomPromptModal(true)
                setCustomPromptText('')
              }}
              disabled={generatingIdeas || generatingPrompt}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>📝</span>
              <span>Вставить готовый промпт</span>
            </button>
          </div>

          {ideas.length > 0 && (
            <div>
              <h3>Сгенерированные идеи:</h3>
              <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                {ideas.map((idea, index) => (
                  <div
                    key={idea.id}
                    onClick={() => handleSelectIdea(idea)}
                    style={{
                      padding: '1rem',
                      border: selectedIdea?.id === idea.id ? '2px solid #667eea' : '2px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selectedIdea?.id === idea.id ? '#f0f4ff' : 'white',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{index + 1}. {idea.title}</strong>
                      {generatingPrompt && selectedIdea?.id === idea.id && (
                        <span style={{ color: '#667eea' }}>⏳ Генерация промпта...</span>
                      )}
                    </div>
                    <p style={{ margin: '0', color: '#718096' }}>{idea.description}</p>
                    {selectedIdea?.id !== idea.id && (
                      <button
                        className="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectIdea(idea)
                        }}
                        disabled={generatingPrompt}
                        style={{ marginTop: '0.5rem' }}
                      >
                        Выбрать
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="button button-secondary"
                onClick={handleGenerateIdeas}
                disabled={generatingIdeas}
                style={{ marginTop: '1rem' }}
              >
                {generatingIdeas ? 'Генерация...' : 'Сгенерировать ещё идеи'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Модалка голосового ввода */}
      {showVoiceModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseVoiceModal()
            }
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Предложить свою идею</h2>
            
            <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
              Нажмите на микрофон и вслух опишите идею 8-секундного видео. 
              Например: "Придумай 8-секундный промпт, где бабушка и дедушка копают огород".
              <br />
              <small style={{ fontSize: '0.875rem', color: '#a0aec0' }}>
                Используется OpenAI Whisper для распознавания речи
              </small>
            </p>

            {recordingError && (
              <div className="error" style={{ marginBottom: '1rem' }}>
                {recordingError}
              </div>
            )}

            <div className="input-group">
              <label>Ваша идея</label>
              <textarea
                value={voiceIdeaText}
                onChange={(e) => setVoiceIdeaText(e.target.value)}
                placeholder="Опишите идею видео или надиктуйте её голосом..."
                rows={6}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                disabled={isTranscribing}
              />
            </div>

            {/* Показываем статус записи */}
            {isRecording && (
              <div style={{ 
                padding: '0.75rem', 
                background: '#fef2f2', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                textAlign: 'center',
                color: '#ef4444'
              }}>
                🎤 Идёт запись... Нажмите ещё раз, чтобы остановить
              </div>
            )}

            {/* Показываем статус транскрипции */}
            {isTranscribing && (
              <div style={{ 
                padding: '0.75rem', 
                background: '#f7fafc', 
                borderRadius: '8px', 
                marginBottom: '1rem',
                textAlign: 'center',
                color: '#667eea'
              }}>
                ⏳ Преобразуем голос в текст...
              </div>
            )}

            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '1rem',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <button
                onClick={handleToggleRecording}
                disabled={isTranscribing || generatingPrompt}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isRecording ? '#ef4444' : '#667eea',
                  color: 'white',
                  fontSize: '2rem',
                  cursor: (isTranscribing || generatingPrompt) ? 'not-allowed' : 'pointer',
                  opacity: (isTranscribing || generatingPrompt) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isTranscribing && !generatingPrompt) {
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                🎤
              </button>
              <p style={{ 
                margin: 0, 
                fontSize: '0.875rem', 
                color: '#718096',
                textAlign: 'center'
              }}>
                {isRecording 
                  ? 'Говорите... Нажмите ещё раз, чтобы остановить' 
                  : isTranscribing
                  ? 'Обрабатываем запись...'
                  : 'Нажмите, чтобы начать запись'}
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              flexWrap: 'wrap',
              justifyContent: 'flex-end'
            }}>
              <button
                className="button button-secondary"
                onClick={handleClearVoiceText}
                disabled={generatingPrompt || isTranscribing || !voiceIdeaText}
              >
                Очистить
              </button>
              <button
                className="button button-secondary"
                onClick={handleCloseVoiceModal}
                disabled={generatingPrompt || isTranscribing}
              >
                Отмена
              </button>
              <button
                className="button"
                onClick={handleGeneratePromptFromVoice}
                disabled={!voiceIdeaText.trim() || generatingPrompt || isTranscribing}
              >
                {generatingPrompt ? '⏳ Генерация промпта...' : 'Сгенерировать промпт'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка "Вставить готовый промпт" */}
      {showCustomPromptModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCustomPromptModal(false)
              setCustomPromptText('')
            }
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Вставить готовый промпт для видео</h2>
            
            <p style={{ color: '#718096', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              Вставьте сюда уже подготовленный промпт для Veo 3.1 Fast. Мы сразу перейдём к шагу генерации видео.
            </p>

            <div className="input-group">
              <label>Промпт для Veo 3.1 Fast</label>
              <textarea
                value={customPromptText}
                onChange={(e) => setCustomPromptText(e.target.value)}
                placeholder="Вставьте ваш промпт для Veo..."
                rows={8}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
            </div>

            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              marginTop: '1.5rem'
            }}>
              <button
                className="button button-secondary"
                onClick={() => {
                  setShowCustomPromptModal(false)
                  setCustomPromptText('')
                }}
              >
                Отмена
              </button>
              <button
                className="button"
                onClick={() => {
                  if (!customPromptText.trim()) return
                  
                  console.log('[customPrompt] confirm and go to step 3')
                  console.log('[customPrompt] prompt length:', customPromptText.trim().length)
                  
                  // Устанавливаем промпт и переходим на шаг 3
                  setVeoPrompt(customPromptText.trim())
                  setVideoTitle('') // Очищаем название, пользователь может ввести своё на шаге 3
                  setShowCustomPromptModal(false)
                  setCustomPromptText('')
                  setStep(3)
                  setSuccess('Промпт вставлен. Можете отредактировать его при необходимости.')
                }}
                disabled={!customPromptText.trim()}
              >
                Продолжить к генерации
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Шаг 3: Промпт + генерация видео */}
      {step === 3 && selectedChannel && (
        <div>
          <button
            className="button button-secondary"
            onClick={() => {
              setStep(2)
              setVeoPrompt('')
              setVideoTitle('')
            }}
            style={{ marginBottom: '1rem' }}
          >
            ← Назад
          </button>

          {jobCreationInfo && (
            <div
              className="success"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <span>
                ✅ Задача {jobCreationInfo.title ? `"${jobCreationInfo.title}"` : jobCreationInfo.id} создана. Видео генерируется...
              </span>
              <button
                onClick={() => setJobCreationInfo(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2d3748',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
                aria-label="Закрыть уведомление о задаче"
              >
                X
              </button>
            </div>
          )}

          {selectedIdea && (
            <div style={{ background: '#f7fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Выбранная идея:</h3>
              <strong>{selectedIdea.title}</strong>
              <p style={{ margin: '0.5rem 0 0 0', color: '#718096' }}>{selectedIdea.description}</p>
            </div>
          )}

          <div className="input-group">
            <label>
              Промпт для Veo 3.1 Fast
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleCopyPrompt}
                  disabled={!veoPrompt.trim()}
                  style={{ 
                    fontSize: '0.875rem', 
                    padding: '0.5rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  title="Скопировать промпт в буфер обмена"
                >
                  📋 Скопировать промпт
                </button>
              </div>
            </label>
            <textarea
              value={veoPrompt}
              onChange={(e) => setVeoPrompt(e.target.value)}
              placeholder="Промпт для генерации видео..."
              rows={6}
            />
            {selectedIdea && (
              <button
                className="button button-secondary"
                onClick={handleRegeneratePrompt}
                disabled={generatingPrompt}
                style={{ marginTop: '0.5rem' }}
              >
                {generatingPrompt ? 'Генерация...' : '🔄 Сгенерировать промпт ещё раз'}
              </button>
            )}
          </div>

          <div className="input-group">
            <label>Название ролика</label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => {
                setVideoTitle(e.target.value)
                // Сбрасываем отслеживание автогенерированного названия, если пользователь редактирует
                if (e.target.value !== lastAutoGeneratedTitle) {
                  setLastAutoGeneratedTitle('')
                }
              }}
              placeholder="Название видео для YouTube..."
            />
            {generatingTitle && (
              <div style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.875rem', 
                color: '#667eea',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid #667eea',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }}></span>
                Придумываем название...
              </div>
            )}
          </div>

          {/* Настройки уведомлений - collapsible */}
          <NotificationSettingsCollapsible notifications={notifications} />

          <div className="video-generation-actions">
            <div className="video-generation-actions__buttons">
              <button
                className="button"
                onClick={handleGenerateVideo}
                disabled={loading || !veoPrompt.trim() || activeJobsCount >= maxActiveJobs}
              >
                {loading ? '⏳ Создание задачи...' : '🎬 Сгенерировать видео'}
              </button>
              
              <button
                className="button button-secondary"
                onClick={handleRegenerateVideo}
                disabled={loading || !veoPrompt.trim() || activeJobsCount >= maxActiveJobs}
                title="Создать новую задачу генерации с тем же промптом"
              >
                🔄 Сгенерировать ещё раз
              </button>
            </div>
            
            {activeJobsCount >= maxActiveJobs && (
              <div className="video-generation-actions__warning">
                ⚠️ Доступно не более {maxActiveJobs} одновременных генераций. Подождите, пока одна из задач завершится.
              </div>
            )}
          </div>

          {/* Закреплённая панель действий для мобильных */}
          <div className="mobile-actions-panel">
            {/* Первая строка - 4 компактные кнопки */}
            <div className="mobile-actions-panel__row mobile-actions-panel__row--icons">
              <button
                className="mobile-actions-panel__icon-button"
                onClick={handleGoBack}
                title="Назад"
              >
                <span className="mobile-actions-panel__icon">⬅️</span>
                <span className="mobile-actions-panel__label">Назад</span>
              </button>
              <button
                className="mobile-actions-panel__icon-button"
                onClick={handleGoHome}
                title="Главное"
              >
                <span className="mobile-actions-panel__icon">🏠</span>
                <span className="mobile-actions-panel__label">Главное</span>
              </button>
              <button
                className="mobile-actions-panel__icon-button"
                onClick={handleCopyPrompt}
                title="Скопировать промпт"
              >
                <span className="mobile-actions-panel__icon">📋</span>
                <span className="mobile-actions-panel__label">Промпт</span>
              </button>
              <button
                className="mobile-actions-panel__icon-button"
                onClick={handleCopyTitle}
                title="Скопировать название"
              >
                <span className="mobile-actions-panel__icon">📋</span>
                <span className="mobile-actions-panel__label">Название</span>
              </button>
            </div>
            {/* Вторая строка - основная кнопка генерации */}
            <div className="mobile-actions-panel__row mobile-actions-panel__row--main">
              <button
                className="button mobile-actions-panel__generate"
                onClick={handleGenerateVideo}
                disabled={loading || !veoPrompt.trim() || activeJobsCount >= maxActiveJobs}
              >
                {loading ? '⏳ Создание задачи...' : '🎬 Сгенерировать видео'}
              </button>
            </div>
          </div>

          {/* Список задач */}
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
            showChannelName={false}
          />

        </div>
      )}
    </div>
  )
}

export default VideoGeneration
