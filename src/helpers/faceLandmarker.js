export async function createFaceLandmarker() {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const files = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm',
  )
  const options = {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
  }
  try {
    return await FaceLandmarker.createFromOptions(files, options)
  } catch {
    return FaceLandmarker.createFromOptions(files, {
      ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' },
    })
  }
}
