import * as CANNON from 'cannon'
import React, { useState, useEffect, useContext, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
// Cannon-world context provider
export const cannonContext = React.createContext()
export function Provider({ children }) {
  // Set up physics
  const [world] = useState(() => new CANNON.World())
  useEffect(() => {
    world.broadphase = new CANNON.NaiveBroadphase()
    world.solver.iterations = 10
    world.gravity.set(0, 0, 0)
  }, [world])

  // Run world stepper every frame
  useFrame(() => world.step(1 / 60))
  // Distribute world via context
  return <cannonContext.Provider value={world} children={children} />
}

// Custom hook to maintain a world physics body
export function useCannon({ ...props }, fn, deps = []) {
  const ref = useRef()
  // Get cannon world object
  const world = useContext(cannonContext)
  // Instanciate a physics body
  const [body] = useState(() => new CANNON.Body(props))
  useEffect(() => {
    // Call function so the user can add shapes
    fn(body)
    // Add body to world on mount
    world.addBody(body)
    // const forceTimer = setTimeout(() => {
    //   console.log('push')
    //   body.applyForce(new CANNON.Vec3(0, 4, 0), new CANNON.Vec3(0, 0, 0))
    // }, 1000)
    // Remove body on unmount
    return () => {
      world.removeBody(body)
      // clearTimeout(forceTimer)
    }
  }, [deps, world, body, fn])

  useFrame(() => {
    if (ref.current) {
      // Transport cannon physics into the referenced threejs object
      ref.current.position.copy(body.position)
      ref.current.quaternion.copy(body.quaternion)
    }
  })

  return ref
}
