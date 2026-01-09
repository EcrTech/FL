import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  Building2, 
  Settings, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  ExternalLink,
  Copy,
  Shield,
  Webhook,
  RefreshCw
} from "lucide-react";

interface RBLConfig {
  id: string;
  org_id: string;
  environment: "uat" | "production";
  api_endpoint: string;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  payment_mode: string | null;
  amount: number | null;
  status: string;
  reference_id: string;
  utr_number: string | null;
  beneficiary_name: string | null;
  created_at: string;
  error_message: string | null;
}

const RBLBankSettings = () => {
  const { orgId: effectiveOrgId } = useOrgContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("configuration");

  // Form states
  const [uatEndpoint, setUatEndpoint] = useState("");
  const [uatClientId, setUatClientId] = useState("");
  const [prodEndpoint, setProdEndpoint] = useState("");
  const [prodClientId, setProdClientId] = useState("");

  // Fetch RBL configurations
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ["rbl-bank-config", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from("rbl_bank_config")
        .select("*")
        .eq("org_id", effectiveOrgId);
      
      if (error) throw error;
      
      // Set form values from existing config
      const uatConfig = data?.find(c => c.environment === "uat");
      const prodConfig = data?.find(c => c.environment === "production");
      
      if (uatConfig) {
        setUatEndpoint(uatConfig.api_endpoint || "");
        setUatClientId(uatConfig.client_id || "");
      }
      if (prodConfig) {
        setProdEndpoint(prodConfig.api_endpoint || "");
        setProdClientId(prodConfig.client_id || "");
      }
      
      return data as RBLConfig[];
    },
    enabled: !!effectiveOrgId,
  });

  // Fetch recent transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["rbl-transactions", effectiveOrgId],
    queryFn: async () => {
      if (!effectiveOrgId) return [];
      const { data, error } = await supabase
        .from("rbl_payment_transactions")
        .select("*")
        .eq("org_id", effectiveOrgId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!effectiveOrgId,
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async ({ environment, api_endpoint, client_id }: { 
      environment: "uat" | "production"; 
      api_endpoint: string; 
      client_id: string;
    }) => {
      if (!effectiveOrgId) throw new Error("Organization not found");

      const existingConfig = configs?.find(c => c.environment === environment);

      if (existingConfig) {
        const { error } = await supabase
          .from("rbl_bank_config")
          .update({ api_endpoint, client_id, updated_at: new Date().toISOString() })
          .eq("id", existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rbl_bank_config")
          .insert({ 
            org_id: effectiveOrgId, 
            environment, 
            api_endpoint, 
            client_id,
            is_active: false 
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rbl-bank-config"] });
      toast.success(`${variables.environment.toUpperCase()} configuration saved`);
    },
    onError: (error) => {
      toast.error(`Failed to save configuration: ${error.message}`);
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("rbl_bank_config")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rbl-bank-config"] });
      toast.success("Configuration status updated");
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Success</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "processing":
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const uatConfig = configs?.find(c => c.environment === "uat");
  const prodConfig = configs?.find(c => c.environment === "production");

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rbl-webhook-handler`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              RBL Bank Integration
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure RBL Bank APIs for disbursements and collections
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="configuration" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Transactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="configuration" className="space-y-6 mt-6">
            {/* UAT Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="secondary">UAT</Badge>
                      Sandbox Environment
                    </CardTitle>
                    <CardDescription>
                      Configure UAT/Sandbox API credentials for testing
                    </CardDescription>
                  </div>
                  {uatConfig && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="uat-active">Active</Label>
                      <Switch
                        id="uat-active"
                        checked={uatConfig.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: uatConfig.id, is_active: checked })
                        }
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="uat-endpoint">API Endpoint</Label>
                    <Input
                      id="uat-endpoint"
                      placeholder="https://apigw-uat.rblbank.com"
                      value={uatEndpoint}
                      onChange={(e) => setUatEndpoint(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uat-client-id">Client ID</Label>
                    <Input
                      id="uat-client-id"
                      placeholder="Your UAT Client ID"
                      value={uatClientId}
                      onChange={(e) => setUatClientId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Client Secret should be configured in environment secrets (RBL_CLIENT_SECRET_UAT)
                </div>
                <Button
                  onClick={() => saveConfigMutation.mutate({
                    environment: "uat",
                    api_endpoint: uatEndpoint,
                    client_id: uatClientId,
                  })}
                  disabled={saveConfigMutation.isPending || !uatEndpoint}
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save UAT Configuration
                </Button>
              </CardContent>
            </Card>

            {/* Production Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="default">PRODUCTION</Badge>
                      Live Environment
                    </CardTitle>
                    <CardDescription>
                      Configure Production API credentials for live transactions
                    </CardDescription>
                  </div>
                  {prodConfig && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="prod-active">Active</Label>
                      <Switch
                        id="prod-active"
                        checked={prodConfig.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: prodConfig.id, is_active: checked })
                        }
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prod-endpoint">API Endpoint</Label>
                    <Input
                      id="prod-endpoint"
                      placeholder="https://apigw.rblbank.com"
                      value={prodEndpoint}
                      onChange={(e) => setProdEndpoint(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod-client-id">Client ID</Label>
                    <Input
                      id="prod-client-id"
                      placeholder="Your Production Client ID"
                      value={prodClientId}
                      onChange={(e) => setProdClientId(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  Client Secret should be configured in environment secrets (RBL_CLIENT_SECRET_PRODUCTION)
                </div>
                <Button
                  onClick={() => saveConfigMutation.mutate({
                    environment: "production",
                    api_endpoint: prodEndpoint,
                    client_id: prodClientId,
                  })}
                  disabled={saveConfigMutation.isPending || !prodEndpoint}
                >
                  {saveConfigMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Production Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configuration</CardTitle>
                <CardDescription>
                  Share these webhook URLs with RBL Bank for receiving transaction status updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Transaction Status Webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">Expected Webhook Payload</h4>
                  <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
{`{
  "event_type": "PAYMENT_STATUS",
  "reference_id": "DISB-xxx",
  "utr_number": "IMPS123456",
  "status": "SUCCESS | FAILED | PENDING",
  "amount": 50000.00,
  "transaction_date": "2026-01-09T14:30:00+05:30",
  "failure_reason": "Optional error message"
}`}
                  </pre>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="h-4 w-4" />
                  Contact RBL Bank technical team to configure these webhooks
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>
                      View all RBL Bank API transactions
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["rbl-transactions"] })}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Reference ID</TableHead>
                        <TableHead>UTR</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">
                            {format(new Date(tx.created_at), "dd MMM yyyy HH:mm")}
                          </TableCell>
                          <TableCell className="capitalize">
                            {tx.transaction_type.replace("_", " ")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.payment_mode || "N/A"}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {tx.reference_id}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {tx.utr_number || "-"}
                          </TableCell>
                          <TableCell>
                            {tx.amount ? `₹${tx.amount.toLocaleString()}` : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RBLBankSettings;
