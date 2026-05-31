import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, ShieldCheck, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col items-center gap-8 px-6 py-16 text-center sm:items-start sm:text-left">
        <div>
          <Badge variant="outline" className="mb-4">Bollywood MVP</Badge>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Film Investment Intelligence
          </h1>
          <p className="mt-3 max-w-lg text-lg text-muted-foreground">
            Decision-support platform for Bollywood producers and financiers. Evaluate greenlight viability, assess risk, and simulate returns.
          </p>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3">
          <Card className="text-left">
            <CardHeader>
              <BarChart3 className="mb-2 size-5 text-emerald-600" />
              <CardTitle className="text-sm">Producer View</CardTitle>
              <CardDescription>Greenlight scoring with explainable component breakdown</CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-left">
            <CardHeader>
              <ShieldCheck className="mb-2 size-5 text-blue-600" />
              <CardTitle className="text-sm">Financier View</CardTitle>
              <CardDescription>Capital recovery probability and risk diagnosis</CardDescription>
            </CardHeader>
          </Card>
          <Card className="text-left">
            <CardHeader>
              <TrendingUp className="mb-2 size-5 text-amber-600" />
              <CardTitle className="text-sm">ROI Scenarios</CardTitle>
              <CardDescription>Pessimistic, base, and optimistic financial projections</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <div className="flex gap-3">
          <Link href="/evaluate">
            <Button size="lg">
              Start Evaluation
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg">
              View Dataset
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
