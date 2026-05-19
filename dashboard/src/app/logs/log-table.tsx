'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteViolations } from './actions'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Violation = {
  id: string
  timestamp: string
  violation_type: string
  confidence: number
  screenshot_url: string
  status: string
}

export function LogTable({ initialViolations }: { initialViolations: Violation[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const formatViolationType = (type: string) => {
    switch(type) {
      case 'no_both': return 'Tanpa Masker & Hairnet'
      case 'no_mask': return 'Tanpa Masker'
      case 'no_hairnet': return 'Tanpa Hairnet'
      case 'left_post': return 'Meninggalkan Pos'
      default: return type
    }
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(initialViolations.map(v => v.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    setIsDeleteDialogOpen(false)
    setIsDeleting(true)
    const result = await deleteViolations(Array.from(selectedIds))
    setIsDeleting(false)

    if (result.success) {
      toast.success(`${selectedIds.size} log pelanggaran berhasil dihapus.`)
      setSelectedIds(new Set())
      // revalidatePath in actions.ts will automatically refresh the server component data
    } else {
      toast.error("Gagal menghapus log", {
        description: result.error
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {selectedIds.size} baris terpilih
        </p>
        <Button 
          variant="destructive" 
          size="sm" 
          disabled={selectedIds.size === 0 || isDeleting}
          onClick={handleDeleteSelected}
          className="bg-red-900/50 text-red-400 hover:bg-red-900 hover:text-white border border-red-900"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {isDeleting ? 'Menghapus...' : 'Hapus Terpilih'}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
            <TableHead className="w-12 text-center">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-blue-600"
                checked={initialViolations.length > 0 && selectedIds.size === initialViolations.length}
                onChange={handleSelectAll}
                disabled={initialViolations.length === 0}
              />
            </TableHead>
            <TableHead className="text-zinc-400">Waktu</TableHead>
            <TableHead className="text-zinc-400">Jenis Pelanggaran</TableHead>
            <TableHead className="text-zinc-400">Kepercayaan (AI)</TableHead>
            <TableHead className="text-zinc-400">Bukti Foto</TableHead>
            <TableHead className="text-zinc-400">Status Review</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialViolations?.map((v) => (
            <TableRow 
              key={v.id} 
              className={`border-zinc-800 transition-colors ${selectedIds.has(v.id) ? 'bg-blue-900/10' : 'hover:bg-zinc-800/50'}`}
            >
              <TableCell className="text-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-blue-600"
                  checked={selectedIds.has(v.id)}
                  onChange={() => handleSelectRow(v.id)}
                />
              </TableCell>
              <TableCell className="font-medium text-zinc-300">
                {new Date(v.timestamp).toLocaleString('id-ID')}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="border-red-900/50 text-red-500 bg-red-500/10">
                  {formatViolationType(v.violation_type)}
                </Badge>
              </TableCell>
              <TableCell className="text-zinc-400">
                {(v.confidence * 100).toFixed(1)}%
              </TableCell>
              <TableCell>
                {v.screenshot_url ? (
                  <a href={v.screenshot_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm">
                    Lihat Foto
                  </a>
                ) : (
                  <span className="text-zinc-600 text-sm">Tidak ada</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
                  {v.status === 'new' ? 'Baru' : v.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {(!initialViolations || initialViolations.length === 0) && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-zinc-500">
                Tidak ada data log yang ditemukan.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Konfirmasi Penghapusan</DialogTitle>
            <DialogDescription className="text-zinc-400 mt-2">
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.size} baris</strong> log pelanggaran yang dipilih? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-0 border-t border-zinc-800/50 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              Batal
            </Button>
            <Button 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20"
            >
              Ya, Hapus Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
