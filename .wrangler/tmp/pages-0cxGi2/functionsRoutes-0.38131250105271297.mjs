import { onRequestPost as __api_create_checkout_js_onRequestPost } from "/Users/linusfujisawa/Desktop/Programming/SmartSenior/DigitalMTG/functions/api/create-checkout.js"
import { onRequestGet as __api_verify_session_js_onRequestGet } from "/Users/linusfujisawa/Desktop/Programming/SmartSenior/DigitalMTG/functions/api/verify-session.js"

export const routes = [
    {
      routePath: "/api/create-checkout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_create_checkout_js_onRequestPost],
    },
  {
      routePath: "/api/verify-session",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_verify_session_js_onRequestGet],
    },
  ]