/** POC for three-fiber and cannon (a 3d physics lib)
 *
 *  useCannon is a custom hook that lets you link a physics body to a threejs
 *  mesh with zero effort. It will automatically update the mesh with the
 *  correct positioning.
 *
 *  When components with useCannon mount they are known to cannons world, when
 *  they unmount, they'll remove themselves from physics processing.
 *
 *  Check out three-fiber here: https://github.com/drcmda/react-three-fiber
 */

// 1. User should be able to click and generate a cube
// 2. user can grab and throw cubes
// 3. user should be able to move down the page and the camera should move down the scene
// 4. cubes should look like polished obsidian w/ reflections etc
import * as THREE from 'three'
import * as CANNON from 'cannon'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import styled from 'styled-components'
import ReactDOM from 'react-dom'
import React, { Fragment } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCannon, Provider, cannonContext } from './useCannon'
import { useAspect } from '@react-three/drei'
import './styles.css'

gsap.registerPlugin(ScrollTrigger)

// softShadows({
//   frustum: 3.75, // Frustum width (default: 3.75) must be a float
//   size: 0.0005, // World size (default: 0.005) must be a float
//   near: 9.5, // Near plane (default: 9.5) must be a float
//   samples: 17, // Samples (default: 17) must be a int
//   rings: 11 // Rings (default: 11) must be a int
// })

function Plane({ position, ...restProps }) {
  const scale = useAspect(
    1, // Pixel-width
    1, // Pixel-height
    1 // Optional scaling factor
  )

  // Register plane as a physics body with zero mass
  const ref = useCannon({ mass: 0 }, (body) => {
    body.addShape(new CANNON.Plane())
    body.position.set(...position)
  })
  return (
    <mesh ref={ref} scale={scale} receiveShadow {...restProps}>
      <planeBufferGeometry attach="geometry" />
      <meshStandardMaterial attach="material" color="#ffffff" />
    </mesh>
  )
}

function InstancedBoxes({ count }) {
  // Register box as a physics body with mass
  const world = React.useContext(cannonContext)
  const dummy = React.useMemo(() => new THREE.Object3D(), [])
  const ref = React.useRef()
  const [boxes, setBoxes] = React.useState([])
  const [currentItem, setCurrentItem] = React.useState(0)
  const { camera } = useThree()

  React.useEffect(() => {
    const boxParams = new CANNON.Vec3(1, 1, 1)
    const scrollOffset = getScreenHeight({ camera }) * -2
    const screenBounds = getScreenBounds({ camera })
    const boxes = [...Array(count)].map(() => {
      const pos = [
        THREE.Math.randFloat(screenBounds.left, screenBounds.right),
        THREE.Math.randFloat(-scrollOffset, screenBounds.top),
        THREE.Math.randFloat(1, 10)
      ]
      const aVelocity = [THREE.Math.randFloat(-1, 1), THREE.Math.randFloat(-1, 1), THREE.Math.randFloat(-1, 1)]
      const velocity = [THREE.Math.randFloat(-0.5, 0.5), THREE.Math.randFloat(-0.5, 0.5), THREE.Math.randFloat(-0.5, 0.5)]
      const body = new CANNON.Body({ mass: 1 })
      body.addShape(new CANNON.Box(boxParams))
      body.position.set(...pos)
      body.velocity.set(...velocity)
      body.angularVelocity.set(...aVelocity)
      body.scale = { x: 1, y: 1, z: 1 }
      world.addBody(body)
      return body
    })
    setBoxes(boxes)

    return () => {
      boxes.forEach((body) => world.removeBody(body))
    }
  }, [count, world, camera])

  React.useEffect(() => {
    const handleClick = (e) => {
      const mouse = {
        x: THREE.Math.lerp(-1, 1, e.clientX / window.innerWidth),
        y: THREE.Math.lerp(1, -1, e.clientY / window.innerHeight)
      }
      const scrollOffset = getScreenHeight({ camera }) * (window.scrollY / window.innerHeight)
      const depth = THREE.Math.randFloat(1, 10)
      const pos = getPos({ mouse, camera, depth })
      const box = resetBody(boxes[currentItem])
      const prevBox = currentItem === count - 1 ? boxes[0] : boxes[currentItem + 1]
      gsap.to(prevBox.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5,
        ease: 'power2.out'
      })

      box.scale = { x: 0, y: 0, z: 0 }
      gsap.to(box.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1,
        ease: 'elastic.out(1.1,0.5)'
      })
      const aVelocity = [THREE.Math.randFloat(-1, 1), THREE.Math.randFloat(-1, 1), THREE.Math.randFloat(-1, 1)]
      const velocity = [THREE.Math.randFloat(-0.5, 0.5), THREE.Math.randFloat(-0.5, 0.5), THREE.Math.randFloat(-0.5, 0.5)]
      box.position.set(pos.x, pos.y + scrollOffset, depth)
      box.velocity.set(...velocity)
      box.angularVelocity.set(...aVelocity)
      setCurrentItem((val) => (val < count - 1 ? val + 1 : 0))
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [boxes, currentItem, count, camera, dummy])

  useFrame(() => {
    boxes.forEach((box, i) => {
      dummy.position.copy(box.position)
      dummy.quaternion.copy(box.quaternion)
      dummy.scale.copy(box.scale)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[null, null, count]} castShadow receiveShadow>
      <boxBufferGeometry attach="geometry" args={[2, 2, 2]} />
      <meshStandardMaterial attach="material" roughness={0.5} color="#050505" />
    </instancedMesh>
  )
}

const resetBody = (body) => {
  // Velocity
  body.velocity.setZero()
  body.initVelocity.setZero()
  body.angularVelocity.setZero()
  body.initAngularVelocity.setZero()

  // Force
  body.force.setZero()
  body.torque.setZero()

  return body
}

// const getPos = ({ mouse, camera }) => {
//   const vector = new THREE.Vector3(mouse.x, mouse.y, 3)
//   vector.unproject(camera)
//   const dir = vector.sub(camera.position).normalize()
//   const distance = -camera.position.z / dir.z
//   const pos = camera.position.clone().add(dir.multiplyScalar(distance))
//   return pos
// }

const getPos = ({ mouse, camera, depth }) => {
  const vector = new THREE.Vector3(mouse.x, mouse.y, 3)
  vector.unproject(camera)
  const dir = vector.sub(camera.position).normalize()
  const distance = -camera.position.z / dir.z
  const pos = camera.position.clone().add(dir.multiplyScalar(distance))
  return pos
}

const getScreenHeight = ({ camera }) => getPos({ mouse: { x: 0, y: -1 }, camera }).y

const getScreenBounds = ({ camera }) => {
  const topLeft = getPos({ mouse: { x: -1, y: 1 }, camera })
  const bottomRight = getPos({ mouse: { x: 1, y: -1 }, camera })
  return { top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y, left: topLeft.x }
}

// const getViewSizeAtDepth = ({ camera, depth }) => {
//   const fovInRadians = THREE.Math.degToRad(camera.fov)
//   const height = Math.abs((camera.position.z - depth) * Math.tan(fovInRadians / 2) * 2)
//   return { width: height * camera.aspect, height }
// }

function Scene({ contentRef, mainContainerRef }) {
  const groupRef = React.useRef()
  const { camera } = useThree()

  React.useEffect(() => {
    const scrollOffset = getScreenHeight({ camera }) * -2

    gsap.to(groupRef.current.position, {
      y: scrollOffset,
      ease: 'none',
      scrollTrigger: {
        trigger: contentRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true
      }
    })
  }, [contentRef, mainContainerRef, camera])

  return (
    <Fragment>
      <pointLight position={[-10, -10, 30]} intensity={0.25} />
      <spotLight
        intensity={0.3}
        position={[30, 30, 50]}
        angle={0.2}
        penumbra={1}
        castShadow
        // shadow-mapSize-width={1024}
        // shadow-mapSize-height={1024}
      />
      <ambientLight intensity={0.5} />
      <Provider>
        <Plane position={[0, 0, 0]} />
        <group ref={groupRef}>
          <InstancedBoxes count={30} />
        </group>
      </Provider>
    </Fragment>
  )
}

export default function App() {
  const contentRef = React.useRef()
  const mainContainerRef = React.useRef()

  return (
    <MainContainer ref={mainContainerRef}>
      <CanvasContainer>
        <Canvas
          shadows
          camera={{ position: [0, 0, 15] }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.outputEncoding = THREE.sRGBEncoding
          }}>
          <Scene contentRef={contentRef} mainContainerRef={mainContainerRef} />
        </Canvas>
      </CanvasContainer>
      <ContentContainer ref={contentRef}>
        <Section>
          <h1>Hello</h1>
        </Section>
        <Section>
          <h1>World</h1>
        </Section>
        <Section>
          <h1>boop</h1>
        </Section>
      </ContentContainer>
    </MainContainer>
  )
}

const MainContainer = styled.div`
  position: relative;
`

const CanvasContainer = styled.div`
  height: 100vh;
  width: 100%;
  position: fixed;
  z-index: 1;
  pointer-events: none;
`
const ContentContainer = styled.div`
  z-index: 2;
  position: relative;
`

const Section = styled.div`
  height: 100vh;
  text-align: center;
`

// const getCurrentViewport = (camera, target, size) => {
//   const { width, height } = size
//   const distance = camera.position.distanceTo(target)
//   const fov = (camera.fov * Math.PI) / 180 // convert vertical fov to radians
//   const h = 2 * Math.tan(fov / 2) * distance // visible height
//   const w = h * (width / height)
//   return { width: w, height: h, factor: width / w, distance }
// }

ReactDOM.render(<App />, document.getElementById('root'))
