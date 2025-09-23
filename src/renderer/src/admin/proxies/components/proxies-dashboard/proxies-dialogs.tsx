import { useState } from 'react'
import { ProxiesActionDialog } from './proxies-action-dialog'
import { ProxiesMutateDrawer } from './proxies-mutate-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useProxies } from '../../context/proxies-context'
import { useToast } from '@/hooks/use-toast'

export default function ProxiesDialogs() {
  const { toast } = useToast()
  const { open, setOpen, currentRow, setCurrentRow, testProxy, rotateProxy, deleteProxy } = useProxies()
  const [isLoading, setIsLoading] = useState(false)

  return (
    <>
      {/* Add/Edit Proxy Drawer */}
      <ProxiesMutateDrawer
        open={open === 'add' || open === 'edit'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setOpen(null)
            setTimeout(() => setCurrentRow(null), 300)
          }
        }}
        currentRow={currentRow}
      />

      {/* Test Proxy Dialog */}
      {open === 'test' && currentRow && (
        <ProxiesActionDialog
          key={`proxy-test-${currentRow.id}`}
          open={true}
          onOpenChange={() => {
            setOpen(null)
            setTimeout(() => setCurrentRow(null), 300)
          }}
          title="Test Proxy"
          description="Are you sure you want to test this proxy? This will send a test request through the proxy to verify its functionality."
          action="Test"
          onAction={async () => {
            setIsLoading(true)
            try {
              await testProxy(currentRow.id)
              toast({
                title: "Proxy Test Successful",
                description: "The proxy is working correctly.",
              })
            } catch (error) {
              toast({
                title: "Proxy Test Failed",
                description: "Failed to verify proxy functionality.",
                variant: "destructive",
              })
            } finally {
              setIsLoading(false)
            }
          }}
          isLoading={isLoading}
        />
      )}

      {/* Rotate Proxy Dialog */}
      {open === 'rotate' && currentRow && (
        <ProxiesActionDialog
          key={`proxy-rotate-${currentRow.id}`}
          open={true}
          onOpenChange={() => {
            setOpen(null)
            setTimeout(() => setCurrentRow(null), 300)
          }}
          title="Rotate Proxy"
          description="Are you sure you want to rotate this proxy? This will request a new IP address from your proxy provider."
          action="Rotate"
          onAction={async () => {
            setIsLoading(true)
            try {
              await rotateProxy(currentRow.id)
              toast({
                title: "Proxy Rotated Successfully",
                description: "A new IP address has been assigned.",
              })
            } catch (error) {
              toast({
                title: "Rotation Failed",
                description: "Failed to rotate proxy IP address.",
                variant: "destructive",
              })
            } finally {
              setIsLoading(false)
            }
          }}
          isLoading={isLoading}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {open === 'delete' && currentRow && (
        <ConfirmDialog
          key={`proxy-delete-${currentRow.id}`}
          open={true}
          onOpenChange={() => {
            setOpen(null)
            setTimeout(() => setCurrentRow(null), 300)
          }}
          title="Delete Proxy"
          desc="Are you sure you want to delete this proxy? This action cannot be undone."
          destructive={true}
          handleConfirm={async () => {
            setIsLoading(true)
            try {
              await deleteProxy(currentRow.id)
              toast({
                title: "Proxy Deleted",
                description: "The proxy has been removed successfully.",
              })
            } catch (error) {
              toast({
                title: "Delete Failed",
                description: "Failed to delete the proxy.",
                variant: "destructive",
              })
            } finally {
              setIsLoading(false)
            }
          }}
          isLoading={isLoading}
        />
      )}
    </>
  )
}
