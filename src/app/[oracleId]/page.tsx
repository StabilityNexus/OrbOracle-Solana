import { Suspense } from "react"
import InteractionClient from "./InteractionClient"

export async function generateStaticParams() {
  return [{ oracleId: 'o' }]
}

export default function OraclePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <InteractionClient />
    </Suspense>
  )
}
