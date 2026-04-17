'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertCircle, CloudOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { cn } from '@/lib/utils'

/**
 * OfflineStatusIndicator — shows the current online/sync status.
 * Floating indicator in the bottom-right corner of the screen.
 * Includes:
 * - Offline banner (auto-dismiss after 5s)
 * - Sync result toast
 * - Sync button when pending items exist
 * - Online/Offline status dot
 */
export function OfflineStatusIndicator() {
  const { isOnline, pendingCount, isSyncing, lastSyncResult, syncNow } = useOfflineSync()
  const [showBanner, setShowBanner] = useState(false)
  const [showResult, setShowResult] = useState(false)

  // Listen for offline events to show banner
  const handleOfflineEvent = useCallback(() => {
    setShowBanner(true)
    // Auto-dismiss after 5s
    setTimeout(() => setShowBanner(false), 5000)
  }, [])

  // Listen for online events to hide banner
  const handleOnlineEvent = useCallback(() => {
    setShowBanner(false)
  }, [])

  // Use proper effect for event subscription
  useEffect(() => {
    window.addEventListener('offline', handleOfflineEvent)
    window.addEventListener('online', handleOnlineEvent)
    return () => {
      window.removeEventListener('offline', handleOfflineEvent)
      window.removeEventListener('online', handleOnlineEvent)
    }
  }, [handleOfflineEvent, handleOnlineEvent])

  const handleSync = async () => {
    const result = await syncNow()
    if (result.synced > 0) {
      setShowResult(true)
      setTimeout(() => setShowResult(false), 3000)
    }
  }

  const hasSyncSuccess = lastSyncResult !== null && lastSyncResult.synced > 0
  const hasSyncError = lastSyncResult !== null && lastSyncResult.errors.length > 0 && lastSyncResult.synced === 0

  return (
    <>
      {/* Offline Banner */}
      <AnimatePresence>
        {showBanner && !isOnline && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white px-4 py-2.5 text-center text-sm font-medium shadow-lg"
          >
            <div className="flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4" />
              <span>Vous êtes hors ligne — les données sont sauvegardées localement</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync Result Toast */}
      <AnimatePresence>
        {showResult && (hasSyncSuccess || hasSyncError) && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
              {hasSyncSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>
                    <strong>{lastSyncResult!.synced}</strong> élément(s) synchronisé(s)
                  </span>
                </>
              ) : hasSyncError ? (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <span>Erreur de synchronisation</span>
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Badge (floating bottom-right) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
            {/* Sync button (only show when there are pending items) */}
            <AnimatePresence>
              {(pendingCount > 0 || isSyncing) && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  {pendingCount > 0 && isOnline && (
                    <Button
                      size="sm"
                      onClick={handleSync}
                      disabled={isSyncing}
                      className={cn(
                        'gap-1.5 shadow-lg rounded-full',
                        isSyncing
                          ? 'bg-amber-500 hover:bg-amber-600'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      )}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span className="text-xs font-medium">
                        {isSyncing ? 'Sync…' : `Sync (${pendingCount})`}
                      </span>
                    </Button>
                  )}
                  {!isOnline && pendingCount > 0 && (
                    <div className="bg-amber-100 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg">
                      <CloudOff className="w-3.5 h-3.5" />
                      {pendingCount} en attente
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Online/Offline indicator */}
            <div
              className={cn(
                'w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-colors',
                isOnline
                  ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                  : 'bg-amber-100 text-amber-600 border border-amber-200'
              )}
            >
              {isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">
            {isOnline
              ? pendingCount > 0
                ? `${pendingCount} élément(s) en attente de synchronisation`
                : 'Connecté — synchronisation activée'
              : 'Hors ligne — données sauvegardées localement'}
          </p>
        </TooltipContent>
      </Tooltip>
    </>
  )
}
