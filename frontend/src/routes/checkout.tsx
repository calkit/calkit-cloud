import { Box } from "@chakra-ui/react"
import { createFileRoute, redirect } from "@tanstack/react-router"
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { z } from "zod"

const checkoutSearchSchema = z.object({
  client_secret: z.string(),
})

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export const Route = createFileRoute("/checkout")({
  component: Checkout,
  validateSearch: (search) => checkoutSearchSchema.parse(search),
  onError: () => {
    throw redirect({ to: "/" })
  },
})

function Checkout() {
  const params = Route.useSearch()
  const options = { clientSecret: params.client_secret }

  return (
    <Box id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </Box>
  )
}
