"use client"

import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Button } from '@/components/ui/button'

interface FaceVerifyProps {
  storedDescriptor: number[];
  onVerifySuccess: () => void;
  onVerifyFail: () => void;
}

export default function FaceVerify({ storedDescriptor, onVerifySuccess, onVerifyFail }: FaceVerifyProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [status, setStatus] = useState("Loading verification system...")
  const [attempts, setAttempts] = useState(0)
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
        setStatus("Verifying identity... Please look at the camera.")
      } catch (err) {
        console.error("Failed to load models", err)
        setStatus("System error. Please contact admin.")
      }
    }
    loadModels()
  }, [])

  // 2. Start webcam
  useEffect(() => {
    if (!modelsLoaded) return

    let currentStream: MediaStream | null = null

    const startVideo = async () => {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream
          setStreamActive(true)
        }
      } catch (err) {
        setStatus("Camera required for exam verification.")
      }
    }

    startVideo()

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [modelsLoaded])

  // 3. Verify loop
  const handleVideoPlay = () => {
    if (!videoRef.current) return
    const video = videoRef.current

    // Reference descriptor from DB
    const referenceDescriptor = new Float32Array(storedDescriptor)

    const interval = setInterval(async () => {
      if (attempts >= 3) {
        clearInterval(interval)
        setStatus("Verification failed 3 times.")
        onVerifyFail()
        return
      }

      const detection = await faceapi.detectSingleFace(video)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (detection) {
        // Compare descriptors
        const distance = faceapi.euclideanDistance(detection.descriptor, referenceDescriptor)
        
        if (distance < 0.5) {
          clearInterval(interval)
          setStatus("Identity verified. Starting exam...")
          setTimeout(onVerifySuccess, 1000)
        } else {
          setAttempts(prev => prev + 1)
          setStatus(`Face not recognized. Attempt ${attempts + 1}/3`)
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className={`text-center font-medium h-6 ${attempts > 0 ? 'text-red-500' : 'text-indigo-700'}`}>
        {status}
      </div>

      <div className="relative w-64 h-64 overflow-hidden rounded-full border-4 border-slate-200 bg-slate-100 shadow-sm">
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          onPlay={handleVideoPlay}
          className={`w-full h-full object-cover transform -scale-x-100 ${!streamActive ? 'hidden' : ''}`}
        />
        
        {!streamActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      
      {attempts >= 3 && (
        <Button variant="destructive" onClick={onVerifyFail}>
          Return to Dashboard
        </Button>
      )}
    </div>
  )
}
