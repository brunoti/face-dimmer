import { remote } from 'electron'
import * as faceapi from 'face-api.js'
import { resolve as pathResolve } from 'path'
import brightness from 'brightness'

import './stylesheets/main.css'
import './helpers/context_menu'
import './helpers/external_links'


const { app } = remote

const initCamera = async () => {
  const cam = document.querySelector('video')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: 500,
      height: 500,
    },
  })
  cam.srcObject = stream
  return new Promise((resolve) => {
    cam.addEventListener('loadedmetadata', () => {
      resolve(cam)
    })
  })
}

faceapi.env.monkeyPatch({
  Canvas: HTMLCanvasElement,
  Image: HTMLImageElement,
  ImageData,
  Video: HTMLVideoElement,
  createCanvasElement: () => document.createElement('canvas'),
  createImageElement: () => document.createElement('img'),
})

let timer = null
let timer2 = null
let isFaceVisible = true
const shouldStop = false

const detect = async (cam, canvas) => {
  const result = await faceapi.detectSingleFace(cam).withFaceLandmarks()


  if (result) {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    faceapi.matchDimensions(canvas, { width: 500, height: 500 })
    const resizedDetections = faceapi.resizeResults(result, { width: 500, height: 500 })
    faceapi.draw.drawDetections(canvas, resizedDetections)

    if (!isFaceVisible) {
      if (!timer2) {
        timer2 = setTimeout(() => {
          isFaceVisible = true
        }, 1000)
      }
      return result
    }

    timer = setTimeout(() => {
      isFaceVisible = false
    }, 1000)
    return result
  }

  if (timer2) {
    clearTimeout(timer2)
    timer2 = null
  }
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  return result
}

const detector = (video, canvas) => ({
  [Symbol.asyncIterator]: () => ({
    async next() {
      if (shouldStop) {
        return ({
          done: true,
        })
      }

      const result = await detect(video, canvas)
      return ({
        value: result,
        done: false,
      })
    },
  }),
})


async function start() {
  console.log('INIT')
  const video = await initCamera()
  console.log('GOT CAMERA')
  const canvas = document.querySelector('canvas')
  console.log('GOT CANVAS')
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(pathResolve(app.getAppPath(), './src/models'))
  await faceapi.nets.faceLandmark68Net.loadFromDisk(pathResolve(app.getAppPath(), './src/models'))
  await faceapi.nets.faceRecognitionNet.loadFromDisk(pathResolve(app.getAppPath(), './src/models'))
  console.log('GOT AI ZICANESS')
  const detections = detector(video, canvas)
  console.log('detections', detections)
  for await (const result of detections) {
    const current = await brightness.get()
    if (!result && !isFaceVisible && current > 0) {
      console.log('DIMMIIINGGG')
      await brightness.set(0)
    } else if (isFaceVisible && current < 1) {
      console.log('GOIN BACK UP')
      await brightness.set(1)
    }
  }
}

start().catch(console.error)
