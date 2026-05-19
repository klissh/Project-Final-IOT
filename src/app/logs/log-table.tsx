'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { deleteViolations } from './actions'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'

type Violation = {
  id: string
  timestamp: string
  violation_type: string
  confidence: number
  screenshot_url: string
  status: string
}

const typeConfig: Record<string, { label: string; variant: 'danger' | 'warning' }> = {
  no_both: { label: 'Tanpa Masker & Hairnet', variant: 'danger' },
  no_mask: { label: 'Tanpa Masker', variant: 'danger' },
  no_hairnet: { label: 'Tanpa Hairnet', variant: 'danger' },
  left_post: { label: 'Meninggalkan Pos', variant: 'warning' },
}

export function LogTable({
  initialViolations,
  currentPage,
  totalPages,
  totalItems,
  activeRange,
}: {
  initialViolations: Violation[]
  currentPage: number
  totalPages: number
  totalItems: number
  activeRange: string
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedIds(e.target.checked ? new Set(initialViolations.map(v => v.id)) : new Set())
  }

  const handleSelectRow = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleteDialogOpen(false)
    setIsDeleting(true)
    const result = await deleteViolations(Array.from(selectedIds))
    setIsDeleting(false)

    if (result.success) {
      toast.success(`${selectedIds.size} log pelanggaran berhasil dihapus.`)
      setSelectedIds(new Set())
    } else {
      toast.error('Gagal menghapus log', { description: result.error })
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedIds.size > 0
            ? <><span className="font-medium text-foreground">{selectedIds.size}</span> baris terpilih</>
            : 'Pilih baris untuk menghapus'}
        </p>
        <Button
          variant="destructive"
          size="sm"
          disabled={selectedIds.size === 0 || isDeleting}
          onClick={() => setIsDeleteDialogOpen(true)}
          className="gap-2"
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />}
          {isDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-foreground cursor-pointer"
                  checked={initialViolations.length > 0 && selectedIds.size === initialViolations.length}
                  onChange={handleSelectAll}
                  disabled={initialViolations.length === 0}
                />
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Waktu</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Jenis Pelanggaran</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Kepercayaan AI</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Bukti Foto</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialViolations?.map((v) => {
              const cfg = typeConfig[v.violation_type] ?? { label: v.violation_type, variant: 'danger' }
              return (
                <TableRow
                  key={v.id}
                  className={`border-border transition-colors cursor-pointer ${selectedIds.has(v.id) ? 'bg-secondary/60' : 'hover:bg-muted/40'
                    }`}
                  onClick={() => handleSelectRow(v.id)}
                >
                  <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-border accent-foreground cursor-pointer"
                      checked={selectedIds.has(v.id)}
                      onChange={() => handleSelectRow(v.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(v.timestamp).toLocaleString('id-ID')}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cfg.variant === 'danger'
                        ? 'border-rose-200 text-rose-600 bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:bg-rose-500/10'
                        : 'border-amber-200 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-500/10'
                      }
                    >
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground/30"
                          style={{ width: `${v.confidence * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        {(v.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    {v.screenshot_url ? (
                      <a
                        href={v.screenshot_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-blue-500 hover:underline"
                      >
                        Lihat Foto
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] text-muted-foreground"
                    >
                      {v.status === 'new' ? 'Baru' : v.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}

            {(!initialViolations || initialViolations.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  Tidak ada data log yang ditemukan.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40">
          <p className="text-xs text-muted-foreground font-mono">
            Menampilkan <span className="font-semibold text-foreground">{(currentPage - 1) * 10 + 1}</span> –{' '}
            <span className="font-semibold text-foreground">{Math.min(currentPage * 10, totalItems)}</span> dari{' '}
            <span className="font-semibold text-foreground">{totalItems}</span> log
          </p>
          
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Link
              href={currentPage > 1 ? `/logs?page=${currentPage - 1}&range=${activeRange}` : '#'}
              className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center border border-border transition-colors ${
                currentPage > 1
                  ? 'bg-card text-foreground hover:bg-secondary'
                  : 'bg-muted/30 text-muted-foreground/50 pointer-events-none cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pNum = idx + 1
                if (
                  pNum === 1 ||
                  pNum === totalPages ||
                  Math.abs(pNum - currentPage) <= 1
                ) {
                  return (
                    <Link
                      key={pNum}
                      href={`/logs?page=${pNum}&range=${activeRange}`}
                      className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center border transition-all ${
                        currentPage === pNum
                          ? 'bg-foreground text-background border-foreground shadow-sm animate-fade-in'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      {pNum}
                    </Link>
                  )
                } else if (
                  pNum === 2 ||
                  pNum === totalPages - 1
                ) {
                  return (
                    <span key={pNum} className="text-xs text-muted-foreground/60 px-1 font-mono">
                      ...
                    </span>
                  )
                }
                return null
              })}
            </div>

            <Link
              href={currentPage < totalPages ? `/logs?page=${currentPage + 1}&range=${activeRange}` : '#'}
              className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center border border-border transition-colors ${
                currentPage < totalPages
                  ? 'bg-card text-foreground hover:bg-secondary'
                  : 'bg-muted/30 text-muted-foreground/50 pointer-events-none cursor-not-allowed'
              }`}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Penghapusan</DialogTitle>
            <DialogDescription className="mt-1">
              Hapus <span className="font-semibold text-foreground">{selectedIds.size} baris</span> log pelanggaran?
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button onClick={handleDeleteConfirm} variant="destructive">
              Ya, Hapus Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}