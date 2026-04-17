'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ImportResult {
  success: boolean
  inserted: number
  duplicates: number
  errors: number
  summary: {
    total: number
    inserted: number
    skipped: number
  }
  duplicatesList: Array<{
    member_number: string
    name: string
    reason: string
  }>
  errorsList: Array<{
    member: string
    error: string
  }>
}

export default function MemberImportPage() {
  const [data, setData] = useState('')
  const [format, setFormat] = useState<'csv' | 'json' | 'text'>('csv')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setData(event.target?.result as string)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!data.trim()) {
      setError('Please provide member data')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, format }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Import failed')
      }

      const importResult = await response.json()
      setResult(importResult)
      setData('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleClearResults = () => {
    setResult(null)
    setError(null)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Import Members</h1>
        <p className="text-muted-foreground mt-2">Upload and parse member data using AI</p>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Data Format</label>
            <div className="flex gap-3">
              {(['csv', 'json', 'text'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    format === fmt
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Upload File</label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".csv,.json,.txt"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <p className="text-sm text-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">CSV, JSON or text files</p>
              </label>
            </div>
          </div>

          {/* Manual Data Entry */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Or Paste Data</label>
            <textarea
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder={`Paste ${format.toUpperCase()} data here...`}
              className="w-full h-64 p-3 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
              <p className="text-sm text-destructive font-medium">Error: {error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={loading || !data.trim()}
              className="flex-1"
            >
              {loading ? 'Importing...' : 'Import Members'}
            </Button>
            {result && (
              <Button
                onClick={handleClearResults}
                variant="outline"
              >
                Clear Results
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Import Results</h2>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground font-medium">Total Records</p>
                <p className="text-2xl font-bold text-foreground mt-2">{result.summary.total}</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-xs text-green-700 font-medium">Inserted</p>
                <p className="text-2xl font-bold text-green-600 mt-2">{result.summary.inserted}</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <p className="text-xs text-yellow-700 font-medium">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600 mt-2">{result.duplicates}</p>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-xs text-red-700 font-medium">Errors</p>
                <p className="text-2xl font-bold text-red-600 mt-2">{result.errors}</p>
              </div>
            </div>

            {/* Duplicates */}
            {result.duplicatesList.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Duplicate Members ({result.duplicates})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground">Member #</th>
                        <th className="text-left p-2 text-muted-foreground">Name</th>
                        <th className="text-left p-2 text-muted-foreground">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.duplicatesList.map((dup, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="p-2 text-foreground">{dup.member_number}</td>
                          <td className="p-2 text-foreground">{dup.name}</td>
                          <td className="p-2 text-yellow-600">{dup.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errorsList.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Import Errors ({result.errors})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground">Member</th>
                        <th className="text-left p-2 text-muted-foreground">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errorsList.map((err, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="p-2 text-foreground">{err.member}</td>
                          <td className="p-2 text-red-600">{err.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
