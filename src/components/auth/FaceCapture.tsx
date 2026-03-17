"use client"

import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Button } from '@/components/ui/button'

interface FaceCaptureProps {
  onCaptureSuccess: (descriptor: Float32Array) => void;
  onSkip?: () => void;
}

export default function FaceCapture({ onCaptureSuccess, onSkip }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [status, setStatus] = useState("Loading face recognition models...")
  const [isCapturing, setIsCapturing] = useState(false)
  const [streamActive, setStreamActive] = useState(false)

  // 1. Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ])
        setModelsLoaded(true)
        setStatus("Waiting for camera permission...")
      } catch (err) {
        console.error("Failed to load models", err)
        setStatus("Failed to load models. Please refresh.")
      }
    }
    loadModels()
  }, [])

  // 2. Start webcam when models are loaded
  useEffect(() => {
    if (!modelsLoaded) return

    let currentStream: MediaStream | null = null

    const startVideo = async () => {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream
          setStreamActive(true)
          setStatus("Position your face in the center")
        }
      } catch (err) {
        console.error("Camera error", err)
        setStatus("Cannot access camera. Please allow permissions.")
      }
    }

    startVideo()

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [modelsLoaded])

  // 3. Handle video play event for continuous scanning
  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const displaySize = { width: video.videoWidth, height: video.videoHeight }
    faceapi.matchDimensions(canvas, displaySize)

    // Capture logic interval
    const interval = setInterval(async () => {
      if (isCapturing) {
        clearInterval(interval)
        return
      }

      const detection = await faceapi.detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor()

      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (detection) {
        const box = detection.detection.box
        const faceArea = box.width * box.height
        const frameArea = video.videoWidth * video.videoHeight
        
        // Face size validation (too far vs good)
        if (faceArea < frameArea * 0.1) {
          setStatus("Move closer to the camera")
        } else if (faceArea > frameArea * 0.6) {
           setStatus("Move slightly back")
        } else {
          setStatus("Hold still... Capturing!")
          setIsCapturing(true)
          clearInterval(interval)
          
          // Draw a green box
          if (ctx) {
            ctx.strokeStyle = '#10B981' // emerald-500
            ctx.lineWidth = 4
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }

          // Delay for UX
          setTimeout(() => {
            onCaptureSuccess(detection.descriptor)
          }, 1500)
        }
      } else {
        setStatus("Position your face in the frame clearly")
      }
    }, 500)

    return () => clearInterval(interval)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="text-center text-sm font-medium h-6 text-indigo-700">
        {status}
      </div>

      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border-4 border-slate-200 bg-slate-100 aspect-video shadow-sm">
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          onPlay={handleVideoPlay}
          className={`w-full h-full object-cover transform -scale-x-100 ${!streamActive ? 'hidden' : ''}`} // Mirrors video
        />
        <canvas 
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
        />
        
        {/* Oval Overlay Guide */}
        {streamActive && !isCapturing && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
            <div className="w-3/5 h-4/5 rounded-[50%] border-2 border-dashed border-indigo-400/70" />
          </div>
        )}

        {/* Loading placeholder */}
        {!streamActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <div className="flex gap-4 pt-4">
        {onSkip && (
          <Button variant="outline" onClick={onSkip} disabled={isCapturing}>
            Skip for now
          </Button>
        )}
      </div>
    </div>
  )
}
