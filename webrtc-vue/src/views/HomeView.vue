<script setup lang="ts">
import { ref } from 'vue'
import WebRtc from '../utils/webrtc'

const rtc = new WebRtc()
const peerList = ref<{name: string}[]>([])
const chatList = ref<{time: string; msg: string; name: string}[]>([])
const login = async () => {
  const name = window.prompt('input your name')
  if (name) {
    await rtc.login(name)
  }
}
rtc.onLiveListChange = list => {
  peerList.value = list
}
rtc.onMessage = (msg, name, fromName) => {
  console.log(18, msg, name, fromName)
  if (name === connectingPeerName.value) {
    chatList.value.push({
      time: new Date().toLocaleString(),
      msg,
      name: fromName
    })
  }
}
rtc.onConnectChange = (state, name) => {
  if (state === 'open') {
    connectingPeerName.value = name
    connecteState.value = 2
    chatList.value = [...rtc.channels[name].history]
  }
}
const chatMsg = ref('')
const connectingPeerName = ref('')
const connecteState = ref(0)
const connect = (name: string) => {
  if (!connecteState.value && connectingPeerName.value !== name) {
    connectingPeerName.value = name
    connecteState.value = 1
    rtc.call(name).then(() => {
      connecteState.value = 2
      chatList.value = [...rtc.channels[name].history]
      console.log(25, connecteState.value)
    })
  }
}
const sendMsg = () => {
  if (chatMsg.value) {
    rtc.send(chatMsg.value)
    chatMsg.value = ''
  }
}
</script>

<template>
  <main>
    <div class="peer-board">
      <button @click="login">login</button>
      <button>refresh</button>
      <div class="peer-list">
        <div v-for="(item, index) in peerList" :key="index" class="peer-item" :class="connectingPeerName === item.name ? ['','connecting', 'connected'][connecteState] : ''" @click="connect(item.name)">{{ item.name }}</div>
      </div>
    </div>
    <div class="msg-board">
      <div class="history">
        <div v-for="(item, index) in chatList" :key="index">
          <div class="time">{{ item.time }}</div>
          <div class="info" :class="{self: item.name === rtc.name}">
            <div>{{ item.name }}</div>
            <div>{{ item.msg }}</div>
          </div>
        </div>
      </div>
      <div class="chat-box">
        <input type="text" v-model="chatMsg">
        <button @click="sendMsg">send</button>
      </div>
    </div>
  </main>
</template>
<style lang="scss">
.peer-item {
  &.connecting {
    color: orange;
  }
  &.connected {
    color: green;
  }
}
</style>