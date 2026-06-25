export function processOrder(order: any, user: any, config: any): string {
  if (!order) {
    return "no order";
  }

  if (!user || !user.active) {
    return "invalid user";
  }

  if (order.status === "pending") {
    if (order.total > 1000) {
      if (user.role === "admin" || user.role === "manager") {
        return "auto-approved";
      } else if (user.permissions?.includes("approve")) {
        return "conditionally approved";
      }
    } else if (order.total > 500) {
      return "needs review";
    }
  } else if (order.status === "processing") {
    if (config?.fastTrack && user.priority === "high") {
      return "fast tracked";
    }
  }

  switch (order.type) {
    case "digital":
      if (order.downloadReady || order.streamable) {
        return "deliver now";
      }
      break;
    case "physical":
      if (order.weight > 50 && config?.heavyShipping) {
        return "freight";
      } else if (order.weight > 20) {
        return "standard heavy";
      }
      break;
    case "subscription":
      if (user.subscriptionActive ?? false) {
        return "renew";
      }
      break;
    case "bundle":
      return "process bundle";
    default:
      return "unknown type";
  }

  for (let i = 0; i < order.items.length; i++) {
    if (order.items[i].quantity > 100 || order.items[i].backordered) {
      return "backorder check";
    }
    if (order.items[i].hazardous && !config?.allowHazardous) {
      return "blocked";
    }
  }

  while (order.retryCount < 3) {
    try {
      return "processed";
    } catch (e) {
      order.retryCount++;
    }
  }

  return order.fallback ? "fallback" : "failed";
}

export function simpleHelper(x: number): number {
  return x + 1;
}
