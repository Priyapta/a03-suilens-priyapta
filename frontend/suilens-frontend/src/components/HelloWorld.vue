<template>
  <v-container class="py-8" max-width="800">
    <v-card>
      <v-card-title>Live Order Notifications</v-card-title>
      <v-divider></v-divider>

      <v-card-text class="py-6" style="min-height: 500px">
        <p class="text-caption text-grey-darken-1 mb-4">
          WebSocket status: {{ connectionStatus }}
        </p>

        <div
          v-if="notifications.length === 0"
          class="text-center text-grey py-8"
        >
          <p class="text-sm">No notifications yet</p>
        </div>

        <div v-else>
          <div
            v-for="(notification, index) in notifications"
            :key="index"
            class="mb-4 pb-4"
            :style="
              index < notifications.length - 1
                ? 'border-bottom: 1px solid #eee;'
                : ''
            "
          >
            <p class="text-sm ma-0">
              Order placed for {{ notification.data.lensName }} by
              {{ notification.data.customerName }}
            </p>
            <p class="text-xs text-grey-darken-1 mt-1">
              {{ formatTime(notification.timestamp) }}
            </p>
          </div>
        </div>
      </v-card-text>

      <v-divider v-if="notifications.length > 0"></v-divider>
      <v-card-actions v-if="notifications.length > 0">
        <v-spacer></v-spacer>
        <v-btn size="small" variant="text" @click="clearNotifications">
          Clear
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

const notifications = ref([]);
const connectionStatus = ref("Connecting...");
const wsUrl =
  import.meta.env.VITE_NOTIFICATION_WS || "ws://localhost:3003/ws";

let socket = null;
let reconnectTimer = null;

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clearNotifications() {
  notifications.value = [];
}

function connectWebSocket() {
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    connectionStatus.value = "Connected";
  };

  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    if (payload.type === "connection.ready") {
      return;
    }

    notifications.value.unshift(payload);
  };

  socket.onclose = () => {
    connectionStatus.value = "Disconnected. Reconnecting...";
    reconnectTimer = window.setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = () => {
    connectionStatus.value = "Connection error";
    socket?.close();
  };
}

onMounted(() => {
  connectWebSocket();
});

onBeforeUnmount(() => {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
  }
  socket?.close();
});
</script>
