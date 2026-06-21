'use client'

/**
 * Error boundary pour capturer les erreurs de rendu côté client.
 * Affiche l'erreur réelle au lieu du message générique de Next.js.
 */

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-red-600">Erreur de chargement</h2>
          <p className="text-sm text-muted-foreground">
            Une erreur est survenue lors du chargement de cette page.
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-xs font-mono text-red-700 dark:text-red-400 break-all">
            {error?.message || 'Unknown error'}
          </p>
          {error?.stack && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer">Stack trace</summary>
              <pre className="text-[10px] font-mono text-red-400 mt-1 overflow-auto max-h-40">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-md hover:bg-amber-600"
          >
            Réessayer
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Retour
          </button>
        </div>
      </div>
    </div>
  )
}
