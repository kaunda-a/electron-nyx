import * as React from 'react'
import { useToast } from '@/hooks/use-toast'
import { ProxyConfig } from '../data/schema'
import { proxiesApi } from '../api/proxies-api'

type ProxiesDialogType = 'add' | 'edit' | 'delete' | 'test' | 'rotate'

interface ProxiesContextType {
  open: ProxiesDialogType | null
  setOpen: (str: ProxiesDialogType | null) => void
  currentRow: ProxyConfig | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ProxyConfig | null>>
  proxies: ProxyConfig[]
  loading: boolean
  error: Error | null
  fetchProxies: () => Promise<void>
  testProxy: (id: string) => Promise<void>
  rotateProxy: (id: string) => Promise<void>
  deleteProxy: (id: string) => Promise<void>
  importProxies: (file: File, type: 'csv' | 'txt') => Promise<boolean>
}

const ProxiesContext = React.createContext<ProxiesContextType | null>(null)

interface Props {
  children: React.ReactNode
}

export function ProxiesProvider({ children }: Props) {
  const { toast } = useToast()
  const toastRef = React.useRef(toast)
  const [open, setOpen] = React.useState<ProxiesDialogType | null>(null)
  const [currentRow, setCurrentRow] = React.useState<ProxyConfig | null>(null)
  const [proxies, setProxies] = React.useState<ProxyConfig[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<Error | null>(null)

  // Update toast ref when toast changes
  React.useEffect(() => {
    toastRef.current = toast
  }, [toast])

  const fetchProxies = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await proxiesApi.list()
      setProxies(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch proxies'))
      toastRef.current({
        title: 'Error',
        description: 'Failed to fetch proxies',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchProxies()
  }, [fetchProxies])

  const testProxy = async (id: string) => {
    try {
      // Placeholder for proxy testing functionality
      // This would need to be implemented on the server side
      toastRef.current({
        title: 'Proxy Test',
        description: 'Proxy testing functionality not yet implemented',
      })
      fetchProxies()
    } catch (err) {
      toastRef.current({
        title: 'Test Failed',
        description: 'Failed to test proxy',
        variant: 'destructive',
      })
    }
  }

  const rotateProxy = async (id: string) => {
    try {
      // Placeholder for proxy rotation functionality
      // This would need to be implemented on the server side
      toastRef.current({
        title: 'Proxy Rotation',
        description: 'Proxy rotation functionality not yet implemented',
      })
      fetchProxies()
    } catch (err) {
      toastRef.current({
        title: 'Rotation Failed',
        description: 'Failed to rotate proxy',
        variant: 'destructive',
      })
    }
  }

  const deleteProxy = async (id: string) => {
    try {
      await proxiesApi.delete(id)
      toastRef.current({
        title: 'Proxy Deleted',
        description: 'Proxy deleted successfully',
      })
      fetchProxies()
    } catch (err) {
      toastRef.current({
        title: 'Deletion Failed',
        description: 'Failed to delete proxy from server',
        variant: 'destructive',
      })
      // Re-throw the error so calling code can handle it
      throw err
    }
  }

  const importProxies = async (file: File, type: 'csv' | 'txt') => {
    try {
      // Placeholder for proxy import functionality
      // This would need to be implemented
      toastRef.current({
        title: 'Import',
        description: 'Proxy import functionality not yet implemented',
        variant: 'destructive',
      })
      fetchProxies()
      return false
    } catch (err) {
      toastRef.current({
        title: 'Import Failed',
        description: err instanceof Error ? err.message : 'Failed to import proxies',
        variant: 'destructive',
      })
      return false
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProxiesContext.Provider
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        proxies,
        loading,
        error,
        fetchProxies,
        testProxy,
        rotateProxy,
        deleteProxy,
        importProxies
      }}
    >
      {children}
    </ProxiesContext.Provider>
  )
}

export function useProxies() {
  const context = React.useContext(ProxiesContext)
  if (!context) {
    throw new Error('useProxies must be used within a ProxiesProvider')
  }
  return context
}

export default ProxiesContext
