/* eslint-disable no-empty */
type Fn = (...args: any[]) => any
const ramStr = (n = 5) => Array(n).fill(1).map(() => ((Math.random() * 36) | 0).toString(36)).join('')

const socket = new WebSocket('ws://localhost:5174')
const wsPromisePool: {
  [k: string]: Fn
} = {}
const wsEventPool: {
  [k: string]: Fn[]
} = {}
socket.addEventListener('message', evt => {
  try {
    const data: {
      hash: string
      type: string
      data: any
      callbackHash: string
    } = JSON.parse(evt.data)
    console.log(20, data)
    switch(data.type) {
      case 'callback':
        if (wsPromisePool[data.hash]) {
          wsPromisePool[data.hash](data.data)
        }
        break
      default:
        if (wsEventPool[data.type]) {
          wsEventPool[data.type].forEach(fn => {
            const res = fn(data)
            if (data.callbackHash) {
              if (res instanceof Promise) {
                res.then(e => wsSend('callback', e, data.callbackHash))
              } else {
                wsSend('callback', res, data.callbackHash)
              }
            }
          })
        }
        break
    }
  }catch{}
})

const wsOn = (eventName: string, callback: Fn, replace = false) => {
  if (!wsEventPool[eventName]) {
    wsEventPool[eventName] = []
  }
  const arr = wsEventPool[eventName]
  if (replace) {
    arr[(arr.length || 1) - 1] = callback
  } else {
    arr.push(callback)
  }
}

const wsSend = <T>(type: string, data?: any, hash?: string) => {
  return new Promise<T>(resolve => {
    const hashKey = hash || ramStr()
    socket.send(JSON.stringify({
      hash: hashKey,
      type,
      data
    }))
    if (!hash) {
      wsPromisePool[hashKey] = res => {
        resolve(res)
        Reflect.deleteProperty(wsPromisePool, hashKey)
      }
    }
  })
}

export default class WebRtc {
  localConnection: RTCPeerConnection
  channel?: RTCDataChannel
  name: string = ''
  currentConnectName: string = ''
  onLiveListChange?: (list: {name: string}[]) => void
  onMessage?: (msg: string, peerName: string, fromName: string) => void
  onConnectChange?: (state: string, fromName: string) => void
  channels: {[k: string]: {
    history: {time: string;msg: string;name: string}[],
    channel: RTCDataChannel
  }} = {}
  constructor() {
    const localConnection = new RTCPeerConnection()
    this.localConnection = localConnection
    localConnection.ondatachannel = this.receiveChannelCallback

    localConnection.onicecandidate = e => {
      if (e.candidate) {
        wsSend('sendICE', {
          requestName: this.name,
          receiveName: this.currentConnectName,
          ice: e.candidate
        })
      }
    }

    wsOn('remoteDSP', async res => {
      this.currentConnectName = res.data.requestName
      await localConnection.setRemoteDescription({type:"offer", sdp: res.data.dsp})
      const answer = await localConnection.createAnswer()
      await localConnection.setLocalDescription(answer)
      return localConnection.localDescription!.sdp
    }, true)
    
    wsOn('remoteICE', async res => {
      localConnection.addIceCandidate(res.data.ice).catch(this.handleAddCandidateError)
    }, true)

    wsOn('liveListChange', res => {
      if (this.onLiveListChange) {
        this.onLiveListChange(res.data)
      }
    }, true)
  }

  login = (name: string) => {
    wsSend('login', name).then(res => {
      this.name = name
    })
  }

  getLiveList = () => {
    wsSend<{name: string}[]>('getLiveList').then(res => {
      if (this.onLiveListChange) {
        this.onLiveListChange(res)
      }
    })
  }

  call = async (name: string) => {
    const channelName = JSON.stringify({
      from: this.name,
      to: name
    })
    if (Reflect.has(this.channels, channelName)) {
      this.currentConnectName = channelName
    } else {
      const channel = this.localConnection.createDataChannel(channelName)
      channel.onmessage = this.handleReceiveMessage
      channel.onopen = this.handleChannelStatusChange
      channel.onclose = this.handleChannelStatusChange
      const offer = await this.localConnection.createOffer()
      await this.localConnection.setLocalDescription(offer)
      const remoteAnswer = await wsSend('sendDSP', {
        requestName: this.name,
        receiveName: name,
        dsp: this.localConnection.localDescription!.sdp
      }) as string
      await this.localConnection.setRemoteDescription({type: "answer", sdp: remoteAnswer})
      this.currentConnectName = channelName

      this.channels[channelName] = {
        history: [],
        channel
      }
    }
    
    return channelName
  }

  send(msg: string) {
    const item = this.channels[this.currentConnectName]
    item.channel?.send(msg)
    item.history?.push({
      name: this.name,
      time: new Date().toLocaleString(),
      msg
    })
    if (this.onMessage) {
      this.onMessage(msg, this.currentConnectName, this.name)
    }
  }
  
  handleChannelStatusChange = (event: Event) => {
    console.log(137, event)
  }

  receiveChannelCallback = (event: RTCDataChannelEvent) => {
    const channel = event.channel
    const {from} = JSON.parse(channel.label)
    if (!Reflect.has(this.channels, from)) {
      channel.onmessage = this.handleReceiveMessage
      channel.onopen = this.handleChannelStatusChange
      channel.onclose = this.handleChannelStatusChange
      this.channels[from] = {
        history: [],
        channel
      }
    }
    this.currentConnectName = channel.label
    if (this.onConnectChange) {
      this.onConnectChange(channel.readyState, from)
    }
  }
  
  handleReceiveMessage = (event: MessageEvent<string>) => {
    const fromChannel = event.target! as RTCDataChannel
    const {from} = JSON.parse(fromChannel.label)
    const item = this.channels[from]
    if (item) {
      item.history.push(
        {
          name: from,
          time: new Date().toLocaleString(),
          msg: event.data
        }
      )
    }
    if (this.onMessage) {
      this.onMessage(event.data, from, from)
    }
  }
  
  handleAddCandidateError(event: Event) {
    console.log(152, event)
  }
}