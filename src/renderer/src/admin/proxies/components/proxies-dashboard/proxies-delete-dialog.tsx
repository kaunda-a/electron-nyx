'use client'

import { useState } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { toast } from '@/hooks/use-toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ProxyConfig } from '../../data/schema'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: ProxyConfig
}

export default function ProxiesDeleteDialog({ open, onOpenChange, currentRow }: Props) {
  const [value, setValue] = useState('')

  // Generate a display name for the proxy if currentRow exists
  const proxyName = currentRow ? `${currentRow.host}:${currentRow.port}` : '';

  const handleDelete = () => {
    if (!currentRow || value.trim() !== proxyName) return

    onOpenChange(false)
    toast({
      title: 'The following proxy has been deleted:',
      description: (
        <pre className='mt-2 w-[340px] rounded-md bg-slate-950 p-4'>
          <code className='text-white'>
            {currentRow ? JSON.stringify(currentRow, null, 2) : 'No proxy data'}
          </code>
        </pre>
      ),
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== proxyName}
      title={
        <span className='text-destructive'>
          <IconAlertTriangle
            className='mr-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Delete Proxy
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            Are you sure you want to delete{' '}
            <span className='font-bold'>{proxyName}</span>?
          </p>
          <Alert variant='destructive'>
            <IconAlertTriangle className='h-4 w-4' />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This action cannot be undone. This will permanently delete the
              proxy and remove all data associated with it.
            </AlertDescription>
          </Alert>
          <div className='space-y-2'>
            <Label htmlFor='confirm'>
              Please type <span className='font-bold'>{proxyName}</span> to
              confirm
            </Label>
            <Input
              id='confirm'
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className='col-span-3'
              autoComplete='off'
            />
          </div>
        </div>
      }
    />
  )
}
