import { useEffect, useRef, useState } from 'react'
import { Buffer } from 'buffer/'
import { Record, Stop, Pause, Play } from '@phosphor-icons/react'

let mediaRecorder: MediaRecorder | undefined
let recordedChunks: Blob[] = []

function App(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [optVideoSource, setOptVideoSource] = useState<{ label: string; value: string }[]>([])
  const [screenId, setScreenId] = useState<string>('')
  const [recorded, setRecorded] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)

  async function setVideoSources() {
    const sources = await window.electron.ipcRenderer.invoke('getSources')
    setOptVideoSource(
      sources.map((d) => ({
        value: d.id,
        label: d.name
      }))
    )
  }

  useEffect(() => {
    setVideoSources()
  }, [])

  const handleRecord = async () => {
    setRecorded(true)
    setIsRecording(true)

    // AUDIO WONT WORK ON MACOS
    const IS_MACOS = (await window.electron.ipcRenderer.invoke('getOperatingSystem')) === 'darwin'
    const audio = !IS_MACOS
      ? {
          mandatory: {
            chromeMediaSource: 'desktop'
          }
        }
      : false

    const constraints = {
      audio,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenId
        }
      }
    }

    // Create a Stream
    const stream = await navigator.mediaDevices.getUserMedia(constraints)

    // Capture microphone audio
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    })

    // Combine both streams
    const tracks = [...stream.getTracks(), ...audioStream.getTracks()]
    const combinedStream = new MediaStream(tracks)

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.onloadedmetadata = () => videoRef.current?.play()

      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' })
      mediaRecorder.ondataavailable = onDataAvailable
      mediaRecorder.onstop = stopRecording
      mediaRecorder.start()
    }
  }

  function onDataAvailable(e) {
    recordedChunks.push(e.data)
  }

  const stopRecording = async () => {
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    const blob = new Blob(recordedChunks, {
      type: 'video/webm; codecs=vp9'
    })

    const buffer = Buffer.from(await blob.arrayBuffer())
    recordedChunks = []

    const { canceled, filePath } = await window.electron.ipcRenderer.invoke('showSaveDialog')
    if (canceled) return

    if (filePath) {
      await window.electron.ipcRenderer.invoke('saveFile', filePath, buffer)
    }
    setIsRecording(false)
  }

  const handlePause = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause()
      setRecorded(false)
    } else if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume()
      setRecorded(true)
    } else if (mediaRecorder && mediaRecorder.state === 'inactive') {
      mediaRecorder.start()
      setRecorded(true)
    }
  }

  // Remove async keyword since it's not needed
  const handleStop = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
    }
  }

  return (
    <div className="min-h-screen justify-center bg-gray-900 text-white flex flex-col items-center py-8 px-4">
      {isRecording && (
        <div className="relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden shadow-xl mb-8">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay></video>
        </div>
      )}

      <div className="flex flex-col items-center gap-6 w-full max-w-xl">
        <div className="flex items-center gap-4 w-full">
          {!isRecording ? (
            <div className="flex w-full flex-col items-center gap-4">
              <div className="flex flex-col gap-2 w-full">
                <label htmlFor="screen-select" className="text-gray-400">
                  Pilih Screen
                </label>
                <select
                  id="screen-select"
                  onChange={(e) => setScreenId(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {optVideoSource.map((source) => (
                    <option key={source.value} value={source.value}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleRecord}
                className="w-full px-3 py-3 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-small transition-colors flex items-center justify-center gap-2"
              >
                <Record size={20} weight="bold" />
                Mulai Rekam
              </button>
            </div>
          ) : (
            <></>
          )}

          {isRecording && (
            <>
              <button
                onClick={handleStop}
                className="w-1/2 px-3 py-3 bg-red-500 hover:bg-red-600 rounded-lg font-small transition-colors flex items-center justify-center gap-2"
              >
                <Stop size={20} weight="bold" />
                Stop
              </button>

              <button
                onClick={handlePause}
                className="w-1/2 px-3 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-small transition-colors flex items-center justify-center gap-2"
              >
                {recorded ? <Pause size={20} weight="bold" /> : <Play size={20} weight="bold" />}
                {recorded ? 'Pause' : 'Start'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
