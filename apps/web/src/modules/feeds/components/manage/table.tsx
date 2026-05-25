"use client";

import { type ColumnDef, flexRender, type Table as ReactTable } from "@tanstack/react-table";
import { Checkbox } from "@vols.rss/ui/checkbox";
import { Button } from "@vols.rss/ui/button";
import { Frame } from "@vols.rss/ui/frame";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@vols.rss/ui/pagination";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@vols.rss/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@vols.rss/ui/table";
import { type FeedRow } from "./table-config";

function getPageRangeOptions(pageCount: number, pageSize: number, totalRows: number) {
  return Array.from({ length: pageCount }, (_, index) => {
    const start = index * pageSize + 1;
    const end = Math.min((index + 1) * pageSize, totalRows);
    const pageNum = index + 1;
    return { label: `${start}-${end}`, value: pageNum };
  });
}

export function TableFrame({
  columnsLength,
  isError,
  isLoading,
  selectedCount,
  table,
  tableData,
}: {
  columnsLength: number;
  isError: boolean;
  isLoading: boolean;
  selectedCount: number;
  table: ReactTable<FeedRow>;
  tableData: FeedRow[];
}) {
  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageOptions = getPageRangeOptions(pageCount, pageSize, tableData.length);

  return (
    <Frame className="w-full">
      <Table variant="card">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableStateRow colSpan={columnsLength}>Loading feeds…</TableStateRow>
          ) : isError ? (
            <TableStateRow colSpan={columnsLength}>Unable to load feeds.</TableStateRow>
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow data-state={row.getIsSelected() ? "selected" : undefined} key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableStateRow colSpan={columnsLength}>No followed feeds yet.</TableStateRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={columnsLength}>
              <div className="flex items-center justify-between gap-2">
                <TableRangeSummary
                  pageCount={pageCount}
                  pageIndex={pageIndex}
                  pageOptions={pageOptions}
                  selectedCount={selectedCount}
                  table={table}
                  totalRows={tableData.length}
                />
                <Pagination className="mx-0 ml-auto w-auto shrink-0 justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        className="sm:*:[svg]:hidden"
                        render={
                          <Button
                            disabled={!table.getCanPreviousPage()}
                            size="sm"
                            variant="outline"
                            onClick={() => table.previousPage()}
                          />
                        }
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        className="sm:*:[svg]:hidden"
                        render={
                          <Button
                            disabled={!table.getCanNextPage()}
                            size="sm"
                            variant="outline"
                            onClick={() => table.nextPage()}
                          />
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Frame>
  );
}

function TableStateRow({ children, colSpan }: { children: React.ReactNode; colSpan: number }) {
  return (
    <TableRow>
      <TableCell className="h-24 text-center text-muted-foreground" colSpan={colSpan}>
        {children}
      </TableCell>
    </TableRow>
  );
}

function TableRangeSummary({
  pageCount,
  pageIndex,
  pageOptions,
  selectedCount,
  table,
  totalRows,
}: {
  pageCount: number;
  pageIndex: number;
  pageOptions: Array<{ label: string; value: number }>;
  selectedCount: number;
  table: ReactTable<FeedRow>;
  totalRows: number;
}) {
  return (
    <div className="min-w-0 flex items-center gap-2 whitespace-nowrap text-muted-foreground text-sm">
      {selectedCount > 0 ? (
        <span>
          <strong className="font-medium text-foreground">{selectedCount}</strong> selected
        </span>
      ) : null}
      {pageCount > 0 ? (
        <>
          <span>Viewing</span>
          <Select
            items={pageOptions}
            value={pageIndex + 1}
            onValueChange={(value) => {
              table.setPageIndex((value as number) - 1);
            }}
          >
            <SelectTrigger className="w-fit min-w-0" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {pageOptions.map(({ label, value }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </>
      ) : (
        <span>Viewing 0</span>
      )}
      <span>
        of <strong className="font-medium text-foreground">{totalRows}</strong>
      </span>
    </div>
  );
}
