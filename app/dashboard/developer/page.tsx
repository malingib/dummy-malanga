'use client'

import { useEffect, useState } from 'react'

type Key = { id: string; name: string; key_prefix: string; key_last4: string; scopes: string[]; status: string; created_at: string; last_used_at?: string | null }
type Endpoint = { id: string; url: string; events: string[]; status: string; created_at: string }

export default function DeveloperPage() {
  const [keys, setKeys] = useState<Key[]>([])
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [name, setName] = useState('Production integration')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const [keyResponse, webhookResponse] = await Promise.all([fetch('/api/developer/keys'), fetch('/api/developer/webhooks')])
    if (keyResponse.ok) setKeys((await keyResponse.json()).keys || [])
    if (webhookResponse.ok) setEndpoints((await webhookResponse.json()).endpoints || [])
  }

  useEffect(() => { void load() }, [])

  async function createKey() {
    const response = await fetch('/api/developer/keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await response.json()
    if (!response.ok) return setMessage(data.error || 'Unable to create key.')
    setSecret(data.secret)
    setMessage('API key created. Copy the secret now; it will not be shown again.')
    void load()
  }

  async function revoke(id: string) {
    const response = await fetch(`/api/developer/keys/${id}`, { method: 'DELETE' })
    setMessage(response.ok ? 'API key revoked.' : 'Unable to revoke API key.')
    void load()
  }

  async function createWebhook() {
    const response = await fetch('/api/developer/webhooks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
    const data = await response.json()
    if (!response.ok) return setMessage(data.error || 'Unable to create webhook.')
    setSecret(data.secret)
    setMessage('Webhook signing secret created. Copy it now; it will not be shown again.')
    setUrl('')
    void load()
  }

  return <main className="mx-auto max-w-5xl space-y-8 p-6">
    <header><h1 className="text-2xl font-semibold">Developer platform</h1><p className="text-sm text-gray-500">Manage tenant API access and payment webhooks.</p></header>
    {message && <div className="rounded border p-3 text-sm">{message}</div>}
    {secret && <div className="rounded border p-4"><p className="mb-2 text-sm font-medium">One-time secret</p><code className="break-all text-sm">{secret}</code><button className="ml-3 underline" onClick={() => setSecret('')}>Hide</button></div>}
    <section className="space-y-3 rounded border p-5"><h2 className="font-semibold">API keys</h2><div className="flex gap-2"><input className="flex-1 rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} /><button className="rounded bg-black px-4 py-2 text-white" onClick={createKey}>Create key</button></div><div className="divide-y">{keys.map((key) => <div className="flex items-center justify-between py-3" key={key.id}><div><p>{key.name}</p><p className="text-sm text-gray-500">{key.key_prefix}••••{key.key_last4} · {key.status}</p></div>{key.status === 'active' && <button className="text-sm underline" onClick={() => revoke(key.id)}>Revoke</button>}</div>)}</div></section>
    <section className="space-y-3 rounded border p-5"><h2 className="font-semibold">Webhooks</h2><div className="flex gap-2"><input className="flex-1 rounded border p-2" placeholder="https://example.com/webhooks" value={url} onChange={(e) => setUrl(e.target.value)} /><button className="rounded bg-black px-4 py-2 text-white" onClick={createWebhook}>Add endpoint</button></div><div className="divide-y">{endpoints.map((endpoint) => <div className="py-3" key={endpoint.id}><p>{endpoint.url}</p><p className="text-sm text-gray-500">{endpoint.events.join(', ')} · {endpoint.status}</p></div>)}</div></section>
  </main>
}
