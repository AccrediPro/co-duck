import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CoachesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Find a Coach</h1>
        <p className="mt-2 text-muted-foreground">
          Browse our community of expert coaches ready to help you succeed.
        </p>
      </div>

      {/* Placeholder content - will be replaced in COACH-011 */}
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>The coach directory is currently being built.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Check back soon to browse our growing list of expert coaches.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
