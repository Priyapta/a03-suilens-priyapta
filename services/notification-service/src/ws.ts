const clients = new Set<any>();

export interface NotificationEventPayload {
  type: string;
  timestamp: string;
  data: {
    orderId: string;
    customerName: string;
    customerEmail: string;
    lensName: string;
  };
}

export function registerClient(ws: any) {
  clients.add(ws);
}

export function unregisterClient(ws: any) {
  clients.delete(ws);
}

export function broadcastNotification(payload: NotificationEventPayload) {
  const message = JSON.stringify(payload);

  for (const client of clients) {
    try {
      client.send(message);
    } catch (error) {
      console.error("Failed to send WebSocket notification:", error);
      clients.delete(client);
    }
  }
}
