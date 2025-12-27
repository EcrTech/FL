import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, IndianRupee, Search, Eye, Filter } from "lucide-react";
import { CollectionRecord } from "@/hooks/useCollections";
import { useNavigate } from "react-router-dom";
import { ClickToCall } from "@/components/Contact/ClickToCall";

interface CollectionsTableProps {
  collections: CollectionRecord[];
  onRecordPayment: (record: CollectionRecord) => void;
}

export function CollectionsTable({ collections, onRecordPayment }: CollectionsTableProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const today = new Date().toISOString().split("T")[0];
    const isOverdue = status === "pending" && dueDate < today;
    
    if (status === "paid") {
      return <Badge className="bg-green-100 text-green-800 text-xs">Paid</Badge>;
    }
    if (status === "partially_paid") {
      return <Badge className="bg-blue-100 text-blue-800 text-xs">Partial</Badge>;
    }
    if (isOverdue || status === "overdue") {
      return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  };

  const filteredCollections = useMemo(() => {
    let filtered = collections;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.application_number.toLowerCase().includes(search) ||
          c.applicant_name.toLowerCase().includes(search) ||
          c.applicant_phone.includes(search)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      const today = new Date().toISOString().split("T")[0];
      filtered = filtered.filter((c) => {
        if (statusFilter === "overdue") {
          return c.status === "overdue" || (c.status === "pending" && c.due_date < today);
        }
        return c.status === statusFilter;
      });
    }

    return filtered;
  }, [collections, searchTerm, statusFilter]);

  const paginatedCollections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCollections.slice(start, start + pageSize);
  }, [filteredCollections, currentPage]);

  const totalPages = Math.ceil(filteredCollections.length / pageSize);

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return {
      total: filteredCollections.length,
      pending: filteredCollections.filter((c) => c.status === "pending" && c.due_date >= today).length,
      overdue: filteredCollections.filter((c) => c.status === "overdue" || (c.status === "pending" && c.due_date < today)).length,
      paid: filteredCollections.filter((c) => c.status === "paid").length,
    };
  }, [filteredCollections]);

  return (
    <div className="space-y-3">
      {/* Compact Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search application, name, phone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[130px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partially_paid">Partial</SelectItem>
          </SelectContent>
        </Select>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-xs ml-auto">
          <span className="text-muted-foreground">
            Total: <strong>{stats.total}</strong>
          </span>
          <span className="text-yellow-600">
            Pending: <strong>{stats.pending}</strong>
          </span>
          <span className="text-red-600">
            Overdue: <strong>{stats.overdue}</strong>
          </span>
          <span className="text-green-600">
            Paid: <strong>{stats.paid}</strong>
          </span>
        </div>
      </div>

      {/* Compact Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="py-2 text-xs font-semibold">App #</TableHead>
                <TableHead className="py-2 text-xs font-semibold">Applicant</TableHead>
                <TableHead className="py-2 text-xs font-semibold">EMI #</TableHead>
                <TableHead className="py-2 text-xs font-semibold">Due Date</TableHead>
                <TableHead className="py-2 text-xs font-semibold text-right">EMI Amt</TableHead>
                <TableHead className="py-2 text-xs font-semibold text-right">Paid</TableHead>
                <TableHead className="py-2 text-xs font-semibold text-right">Balance</TableHead>
                <TableHead className="py-2 text-xs font-semibold">Status</TableHead>
                <TableHead className="py-2 text-xs font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCollections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedCollections.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/30">
                    <TableCell className="py-2 text-xs font-medium">
                      {record.application_number}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{record.applicant_name}</span>
                        {record.applicant_phone && record.contact_id && (
                          <ClickToCall
                            phoneNumber={record.applicant_phone}
                            contactId={record.contact_id}
                            contactName={record.applicant_name}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-center">{record.emi_number}</TableCell>
                    <TableCell className="py-2 text-xs">{formatDate(record.due_date)}</TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium">
                      {formatCurrency(record.total_emi)}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right text-green-600">
                      {formatCurrency(record.amount_paid)}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-right font-medium text-primary">
                      {formatCurrency(record.total_emi - record.amount_paid)}
                    </TableCell>
                    <TableCell className="py-2">
                      {getStatusBadge(record.status, record.due_date)}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center justify-center gap-1">
                        {record.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs px-2"
                            onClick={() => onRecordPayment(record)}
                          >
                            <IndianRupee className="h-3 w-3 mr-1" />
                            Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => navigate(`/los/applications/${record.loan_application_id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredCollections.length)} of{" "}
            {filteredCollections.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
