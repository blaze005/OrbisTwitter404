import Bird from '../actors/Bird.js'
import Cactus from '../actors/Cactus.js'
import Cloud from '../actors/Cloud.js'
import config from '../config.js'
import Dino from '../actors/Dino.js'
import { playSound } from '../sounds.js'
import {
  loadFont,
  loadImage,
  getImageData,
  randBoolean,
  randInteger,
} from '../utils.js'
import GameRunner from './GameRunner.js'

export default class DinoGame extends GameRunner {
  constructor(width, height) {
    super()

    this.width = null
    this.height = null
    this.canvas = this.createCanvas(width, height)
    this.canvasCtx = this.canvas.getContext('2d')
    this.spriteImage = null
    this.spriteImageData = null

    // for resetting settings that change due to difficulty increasing
    this.settingsBackup = { ...config.settings }
    this.state = {
      birds: [],
      cacti: [],
      clouds: [],
      dino: null,
      gameOver: false,
      groundX: 0,
      groundY: 0,
      isRunning: false,
      level: 0,
      score: 0,
    }
  }

  // ref for canvas pixel density:
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#correcting_resolution_in_a_%3Ccanvas%3E
  createCanvas(width, height) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const scale = window.devicePixelRatio

    this.width = width
    this.height = height
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    canvas.width = Math.floor(width * scale)
    canvas.height = Math.floor(height * scale)
    ctx.scale(scale, scale)

    document.body.appendChild(canvas)
    return canvas
  }

  async preload() {
    const [spriteImage] = await Promise.all([
      loadImage('./assets/sprite.png'),
      loadFont('./assets/PressStart2P-Regular.ttf', 'PressStart2P'),
    ])
    this.spriteImage = spriteImage
    this.spriteImageData = getImageData(spriteImage)
    const dino = new Dino(this.spriteImageData)

    dino.x = 25
    dino.baseY = this.height - config.settings.dinoGroundOffset
    this.state.dino = dino
    this.state.groundY = this.height - config.sprites.ground.h / 2
  }

  onFrame() {
    const { state } = this

    this.drawBackground()
    // this.drawFPS()
    this.drawGround()
    this.drawClouds()
    this.drawDino()
    this.drawScore()

    if (state.isRunning) {
      this.drawCacti()

      if (state.level > 3) {
        this.drawBirds()
      }

      if (state.dino.hits([state.cacti[0], state.birds[0]])) {
        playSound('game-over')
        state.gameOver = true
      }

      if (state.gameOver) {
        this.endGame()
      } else {
        this.updateScore()
      }
    }
  }

  onInput(type) {
    const { state } = this

    switch (type) {
      case 'jump': {
        if (state.isRunning) {
          if (state.dino.jump()) {
            playSound('jump')
          }
        } else {
          this.resetGame()
          state.dino.jump()
          playSound('jump')
        }
        break
      }

      case 'duck': {
        if (state.isRunning) {
          state.dino.duck(true)
        }
        break
      }

      case 'stop-duck': {
        if (state.isRunning) {
          state.dino.duck(false)
        }
        break
      }
    }
  }

  resetGame() {
    this.state.dino.reset()
    Object.assign(this.state, {
      birds: [],
      cacti: [],
      gameOver: false,
      isRunning: true,
      level: 0,
      score: 0,
    })

    Object.assign(config.settings, this.settingsBackup)
    this.start()
  }

  endGame() {
    const iconSprite = config.sprites.replayIcon
    const padding = 15

    this.paintText(
      'G A M E  O V E R',
      this.width / 2,
      this.height / 2 - padding,
      {
        font: 'PressStart2P',
        size: '12px',
        align: 'center',
        baseline: 'bottom',
        color: '#535353',
      }
    )

    this.paintSprite(
      'replayIcon',
      this.width / 2 - iconSprite.w / 4,
      this.height / 2 - iconSprite.h / 4 + padding
    )

    this.state.isRunning = false
    this.stop()
  }

  increaseDifficulty() {
    const { settings } = config
    const { bgSpeed, cactiSpawnRate, dinoLegsRate } = settings
    const { level } = this.state

    if (level > 4 && level < 8) {
      settings.bgSpeed++
      settings.birdSpeed = settings.bgSpeed * 0.8
    } else if (level > 7) {
      settings.bgSpeed = Math.ceil(bgSpeed * 1.1)
      settings.birdSpeed = settings.bgSpeed * 0.9
      settings.cactiSpawnRate = Math.floor(cactiSpawnRate * 0.98)

      if (level > 7 && level % 2 === 0 && dinoLegsRate > 3) {
        settings.dinoLegsRate--
      }
    }
  }

  updateScore() {
    const { state } = this

    if (this.frameCount % config.settings.scoreIncreaseRate === 0) {
      const oldLevel = state.level

      state.score++
      state.level = Math.floor(state.score / 100)

      if (state.level !== oldLevel) {
        playSound('level-up')
        this.increaseDifficulty()
      }
    }
  }

  drawFPS() {
    this.paintText('fps: ' + Math.round(this.frameRate), 0, 0, {
      font: 'PressStart2P',
      size: '12px',
      baseline: 'top',
      align: 'left',
      color: '#535353',
    })
  }

  drawBackground() {
    this.canvasCtx.fillStyle = '#f7f7f7'
    this.canvasCtx.fillRect(0, 0, this.width, this.height)
  }

  drawGround() {
    const { state } = this
    const { bgSpeed } = config.settings
    const groundImgWidth = config.sprites.ground.w / 2

    this.paintSprite('ground', state.groundX, state.groundY)
    state.groundX -= bgSpeed

    // append second image until first is fully translated
    if (state.groundX <= -groundImgWidth + this.width) {
      this.paintSprite('ground', state.groundX + groundImgWidth, state.groundY)

      if (state.groundX <= -groundImgWidth) {
        state.groundX = -bgSpeed
      }
    }
  }

  drawClouds() {
    const { clouds } = this.state

    this.progressInstances(clouds)
    if (this.frameCount % config.settings.cloudSpawnRate === 0) {
      const newCloud = new Cloud()
      newCloud.x = this.width
      newCloud.y = randInteger(20, 80)
      clouds.push(newCloud)
    }
    this.paintInstances(clouds)
  }

  drawDino() {
    const { dino } = this.state

    dino.nextFrame()
    this.paintSprite(dino.sprite, dino.x, dino.y)
  }

  drawCacti() {
    const { state } = this
    const { cacti } = state

    this.progressInstances(cacti)
    if (this.frameCount % config.settings.cactiSpawnRate === 0) {
      // randomly either do or don't add cactus
      if (!state.birds.length && randBoolean()) {
        const newCacti = new Cactus(this.spriteImageData)
        newCacti.x = this.width
        newCacti.y = this.height - newCacti.height - 2
        cacti.push(newCacti)
      }
    }
    this.paintInstances(cacti)
  }

  drawBirds() {
    const { birds } = this.state

    this.progressInstances(birds)
    if (this.frameCount % config.settings.birdSpawnRate === 0) {
      // randomly either do or don't add bird
      if (randBoolean()) {
        const newBird = new Bird(this.spriteImageData)
        newBird.x = this.width
        // ensure birds are always at least 5px higher than a ducking dino
        newBird.y =
          this.height -
          Bird.maxBirdHeight -
          Bird.wingSpriteYShift -
          5 -
          config.sprites.dinoDuckLeftLeg.h / 2 -
          config.settings.dinoGroundOffset
        birds.push(newBird)
      }
    }
    this.paintInstances(birds)
  }

  drawScore() {
    this.paintText((this.state.score + '').padStart(5, '0'), this.width, 0, {
      font: 'PressStart2P',
      size: '12px',
      align: 'right',
      baseline: 'top',
      color: '#535353',
    })
  }

  /**
   * For each instance in the provided array, calculate the next
   * frame and remove any that are no longer visible
   * @param {Actor[]} instances
   */
  progressInstances(instances) {
    for (let i = instances.length - 1; i >= 0; i--) {
      const instance = instances[i]

      instance.nextFrame()
      if (instance.rightX <= 0) {
        // remove if off screen
        instances.splice(i, 1)
      }
    }
  }

  /**
   * @param {Actor[]} instances
   */
  paintInstances(instances) {
    for (const instance of instances) {
      this.paintSprite(instance.sprite, instance.x, instance.y)
    }
  }

  paintSprite(spriteName, dx, dy) {
    const { h, w, x, y } = config.sprites[spriteName]
    this.canvasCtx.drawImage(this.spriteImage, x, y, w, h, dx, dy, w / 2, h / 2)
  }

  paintText(text, x, y, opts) {
    const { font = 'serif', size = '12px' } = opts
    const { canvasCtx } = this

    canvasCtx.font = `${size} ${font}`
    if (opts.align) canvasCtx.textAlign = opts.align
    if (opts.baseline) canvasCtx.textBaseline = opts.baseline
    if (opts.color) canvasCtx.fillStyle = opts.color
    canvasCtx.fillText(text, x, y)
  }
}