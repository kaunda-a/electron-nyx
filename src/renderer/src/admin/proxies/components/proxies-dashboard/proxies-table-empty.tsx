import { Button } from '@/components/ui/button'
import { Table } from '@tanstack/react-table'
import { FilterX } from 'lucide-react'

interface ProxiesTableEmptyProps {
  table: Table<any>
  columnsCount: number
}

export function ProxiesTableEmpty({ table, columnsCount }: ProxiesTableEmptyProps) {
  const hasFilters = table.getState().columnFilters.length > 0

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <FilterX className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No Matching Proxies</h3>
      <p className="text-sm text-muted-foreground max-w-md text-center mt-2">
        {hasFilters
          ? "No proxies match your current filters. Try adjusting your search criteria or clear the filters to see all proxies."
          : "No results found. Try a different search term."}
      </p>
      {hasFilters && (
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => table.resetColumnFilters()}
        >
          <FilterX className="mr-2 h-4 w-4" />
          Clear All Filters
        </Button>
      )}
    </div>
  )
}
