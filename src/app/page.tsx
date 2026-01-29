import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Coaching Platform</CardTitle>
          <CardDescription>Connect with expert coaches for personalized guidance</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Find the perfect coach to help you achieve your personal and professional goals.
          </p>
          <div className="flex gap-2">
            <Button>Find a Coach</Button>
            <Button variant="outline">Become a Coach</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
