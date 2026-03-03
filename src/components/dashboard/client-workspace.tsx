'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/date-utils';
import {
  ArrowLeft,
  CalendarDays,
  BookOpen,
  Target,
  CheckSquare,
  Paperclip,
  Plus,
  MoreHorizontal,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { CreateProgramDialog, CreateGoalDialog, CreateTaskDialog } from './client-workspace-dialogs';
import { ClientFilesTab } from './client-files-tab';

interface Client {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastBookingDate: string;
  totalSessions: number;
  activeProgramsCount: number;
}

interface Program {
  id: number;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  startDate: string | null;
  endDate: string | null;
  goalsCount: number;
  goalsCompleted: number;
  createdAt: string;
}

interface ActionItem {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
  goalId?: number | null;
}

interface Goal {
  id: number;
  programId: number;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  createdAt: string;
}

interface ClientWorkspaceProps {
  client: Client;
  initialPrograms: Program[];
  initialActionItems: ActionItem[];
  clientId: string;
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const statusConfig = {
  active: { label: 'Active', variant: 'default' as const },
  completed: { label: 'Completed', variant: 'secondary' as const },
  archived: { label: 'Archived', variant: 'outline' as const },
} as const;

const priorityConfig = {
  high: { label: 'High', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: 'Medium', className: 'bg-gold/15 text-gold-dark dark:bg-gold/20 dark:text-gold' },
  low: { label: 'Low', className: 'bg-sage/10 text-sage dark:bg-sage/20 dark:text-sage' },
} as const;

const goalStatusConfig = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  in_progress: { label: 'In Progress', className: 'bg-burgundy/10 text-burgundy dark:bg-burgundy/20 dark:text-burgundy-light' },
  completed: { label: 'Completed', className: 'bg-sage/10 text-sage dark:bg-sage/20 dark:text-sage' },
} as const;

export function ClientWorkspace({ client, initialPrograms, initialActionItems, clientId }: ClientWorkspaceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>(initialPrograms);
  const [actionItems] = useState<ActionItem[]>(initialActionItems);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<number>>(new Set());
  const [programGoals, setProgramGoals] = useState<Record<number, Goal[]>>({});
  const [loadingGoals, setLoadingGoals] = useState<Record<number, boolean>>({});
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);

  const refreshData = useCallback(() => {
    router.refresh();
  }, [router]);

  const fetchGoalsForProgram = useCallback(async (programId: number) => {
    if (loadingGoals[programId]) return;
    setLoadingGoals((prev) => ({ ...prev, [programId]: true }));
    try {
      const res = await fetch(`/api/programs/${programId}/goals`);
      const json = await res.json();
      if (json.success) {
        setProgramGoals((prev) => ({ ...prev, [programId]: json.data.goals }));
      }
    } catch {
      // Silent fail
    } finally {
      setLoadingGoals((prev) => ({ ...prev, [programId]: false }));
    }
  }, [loadingGoals]);

  const toggleProgram = (programId: number) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) {
        next.delete(programId);
      } else {
        next.add(programId);
        if (!programGoals[programId]) {
          fetchGoalsForProgram(programId);
        }
      }
      return next;
    });
  };

  const handleDeleteProgram = async (programId: number) => {
    try {
      const res = await fetch(`/api/programs/${programId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setPrograms((prev) => prev.filter((p) => p.id !== programId));
        toast({ title: 'Program deleted' });
      } else {
        toast({ title: 'Error', description: json.error?.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete program', variant: 'destructive' });
    }
  };

  const handleDeleteGoal = async (goalId: number, programId: number) => {
    try {
      const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setProgramGoals((prev) => ({
          ...prev,
          [programId]: (prev[programId] || []).filter((g) => g.id !== goalId),
        }));
        toast({ title: 'Goal deleted' });
        refreshData();
      } else {
        toast({ title: 'Error', description: json.error?.message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete goal', variant: 'destructive' });
    }
  };

  const handleProgramCreated = (program: Program) => {
    setPrograms((prev) => [program, ...prev]);
    setShowCreateProgram(false);
    toast({ title: 'Program created', description: program.title });
    refreshData();
  };

  const handleGoalCreated = (goal: Goal) => {
    setProgramGoals((prev) => ({
      ...prev,
      [goal.programId]: [goal, ...(prev[goal.programId] || [])],
    }));
    setShowCreateGoal(false);
    toast({ title: 'Goal created', description: goal.title });
    refreshData();
    fetchGoalsForProgram(goal.programId);
  };

  const handleTaskCreated = () => {
    setShowCreateTask(false);
    toast({ title: 'Task created' });
    refreshData();
  };

  // Get action items for a specific program
  const getTasksForProgram = useCallback((programId: number) => {
    const goals = programGoals[programId] || [];
    const goalIds = new Set(goals.map((g) => g.id));
    return actionItems.filter((item) => item.goalId && goalIds.has(item.goalId));
  }, [programGoals, actionItems]);

  // Calculate progress for a program: (completed goals + completed tasks) / (total goals + total tasks)
  const getProgramProgress = useCallback((program: Program) => {
    const goals = programGoals[program.id] || [];
    const tasks = getTasksForProgram(program.id);

    const completedGoals = goals.filter((g) => g.status === 'completed').length;
    const completedTasks = tasks.filter((t) => t.isCompleted).length;
    const totalGoals = goals.length;
    const totalTasks = tasks.length;
    const total = totalGoals + totalTasks;

    if (total === 0) {
      // Fallback to API-provided goal counts when goals aren't loaded yet
      if (program.goalsCount > 0) {
        return {
          percent: Math.round((program.goalsCompleted / program.goalsCount) * 100),
          completed: program.goalsCompleted,
          total: program.goalsCount,
        };
      }
      return { percent: 0, completed: 0, total: 0 };
    }

    const completed = completedGoals + completedTasks;
    return {
      percent: Math.round((completed / total) * 100),
      completed,
      total,
    };
  }, [programGoals, getTasksForProgram]);

  return (
    <div className="space-y-6">
      {/* Back button + Client header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/clients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarImage src={client.avatarUrl || undefined} />
          <AvatarFallback className="text-lg">{getInitials(client.name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.name || 'Client'}</h1>
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
        <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-4 w-4" />
            {client.totalSessions} sessions
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-4 w-4" />
            {client.activeProgramsCount} active programs
          </span>
        </div>
      </div>

      {/* New Program button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowCreateProgram(true)} size="sm">
          <Plus className="mr-1 h-4 w-4" />
          New Program
        </Button>
      </div>

      {/* Programs list */}
      {programs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No programs</p>
            <p className="text-sm text-muted-foreground">
              Create the first coaching program for this client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => {
            const cfg = statusConfig[program.status];
            const isExpanded = expandedPrograms.has(program.id);
            const progress = getProgramProgress(program);

            return (
              <Card key={program.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => toggleProgram(program.id)}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{program.title}</h3>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      {program.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {program.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {program.startDate && (
                          <span>
                            From {formatDate(program.startDate)}
                          </span>
                        )}
                        {program.endDate && (
                          <span>
                            to {formatDate(program.endDate)}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{progress.completed}/{progress.total} completed</span>
                          <span>{progress.percent}%</span>
                        </div>
                        <Progress
                          value={progress.percent}
                          className={`h-2 ${progress.percent === 100 ? '[&>div]:bg-sage' : ''}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleProgram(program.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProgramId(program.id);
                              setShowCreateGoal(true);
                            }}
                          >
                            <Target className="mr-2 h-4 w-4" />
                            Add Goal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProgramId(program.id);
                              setShowCreateTask(true);
                            }}
                          >
                            <CheckSquare className="mr-2 h-4 w-4" />
                            Add Task
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteProgram(program.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Expanded content with sub-tabs */}
                  {isExpanded && (
                    <ProgramContent
                      program={program}
                      goals={programGoals[program.id] || []}
                      loadingGoals={!!loadingGoals[program.id]}
                      tasks={getTasksForProgram(program.id)}
                      onAddGoal={() => {
                        setSelectedProgramId(program.id);
                        setShowCreateGoal(true);
                      }}
                      onAddTask={() => {
                        setSelectedProgramId(program.id);
                        setShowCreateTask(true);
                      }}
                      onDeleteGoal={(goalId) => handleDeleteGoal(goalId, program.id)}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <CreateProgramDialog
        open={showCreateProgram}
        onOpenChange={setShowCreateProgram}
        clientId={clientId}
        onCreated={handleProgramCreated}
      />
      <CreateGoalDialog
        open={showCreateGoal}
        onOpenChange={setShowCreateGoal}
        programs={programs}
        selectedProgramId={selectedProgramId}
        onCreated={handleGoalCreated}
      />
      <CreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        clientId={clientId}
        onCreated={handleTaskCreated}
      />
    </div>
  );
}

function ProgramContent({
  program,
  goals,
  loadingGoals,
  tasks,
  onAddGoal,
  onAddTask,
  onDeleteGoal,
}: {
  program: Program;
  goals: Goal[];
  loadingGoals: boolean;
  tasks: ActionItem[];
  onAddGoal: () => void;
  onAddTask: () => void;
  onDeleteGoal: (goalId: number) => void;
}) {
  return (
    <div className="mt-4 border-t pt-4">
      <Tabs defaultValue="goals">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="goals" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Goals
            {goals.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {goals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" />
            Tasks
            {tasks.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {tasks.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            Files
          </TabsTrigger>
        </TabsList>

        {/* Goals sub-tab */}
        <TabsContent value="goals" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onAddGoal}>
              <Plus className="mr-1 h-3 w-3" />
              Add Goal
            </Button>
          </div>
          {loadingGoals ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : goals.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No goals yet. Add one to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onDelete={() => onDeleteGoal(goal.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tasks sub-tab */}
        <TabsContent value="tasks" className="mt-3 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onAddTask}>
              <Plus className="mr-1 h-3 w-3" />
              Add Task
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No tasks linked to this program yet.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((item) => (
                <TaskCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Files sub-tab */}
        <TabsContent value="files" className="mt-3">
          <ClientFilesTab programs={[program]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const status = goalStatusConfig[goal.status];
  const priority = priorityConfig[goal.priority];

  return (
    <div className="flex items-start justify-between rounded-lg border p-3">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{goal.title}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priority.className}`}>
            {priority.label}
          </span>
        </div>
        {goal.description && (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{goal.description}</p>
        )}
        {goal.dueDate && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDate(goal.dueDate)}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-destructive" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TaskCard({ item }: { item: ActionItem }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${item.isCompleted ? 'opacity-70' : ''}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className={`font-medium ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
            {item.title}
          </h4>
          {item.isCompleted ? (
            <Badge variant="secondary">Completed</Badge>
          ) : item.dueDate && new Date(item.dueDate) < new Date() ? (
            <Badge variant="destructive">Overdue</Badge>
          ) : (
            <Badge variant="outline">Pending</Badge>
          )}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {item.description}
          </p>
        )}
        {item.dueDate && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Due: {formatDate(item.dueDate)}
          </p>
        )}
      </div>
    </div>
  );
}
