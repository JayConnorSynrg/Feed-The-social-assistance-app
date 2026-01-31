'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MOCK_USERS,
  MOCK_RESOURCES,
  MOCK_POSTS,
  MOCK_APPLICATIONS,
  MOCK_DOCUMENTS,
  MOCK_REMINDERS,
  TEST_SCENARIOS,
  isTestMode,
  setTestMode,
  setTestSession,
  clearTestSession,
  getTestSession,
  type MockUser,
  type TestSession,
} from '@/lib/test-data'
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Users,
  MapPin,
  MessageSquare,
  FileText,
  Bell,
  Database,
  TestTube2,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react'

type ScenarioKey = keyof typeof TEST_SCENARIOS

interface StepStatus {
  step: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  timestamp?: string
  error?: string
}

export default function TestHarnessPage() {
  const router = useRouter()
  const [testModeEnabled, setTestModeEnabled] = useState(false)
  const [currentSession, setCurrentSession] = useState<TestSession | null>(null)
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey | null>(null)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([])
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    setTestModeEnabled(isTestMode())
    setCurrentSession(getTestSession())
  }, [])

  const toggleTestMode = () => {
    const newState = !testModeEnabled
    setTestMode(newState)
    setTestModeEnabled(newState)
    if (!newState) {
      clearTestSession()
      setCurrentSession(null)
      setSelectedScenario(null)
      setStepStatuses([])
    }
  }

  const startScenario = (scenarioKey: ScenarioKey) => {
    const scenario = TEST_SCENARIOS[scenarioKey]
    const user = MOCK_USERS.find((u) => u.id === scenario.userId)

    if (!user) return

    const session: TestSession = {
      userId: scenario.userId,
      scenario: scenarioKey,
      startedAt: new Date().toISOString(),
      currentStep: 0,
      completedSteps: [],
    }

    setTestSession(session)
    setCurrentSession(session)
    setSelectedScenario(scenarioKey)
    setStepStatuses(
      scenario.steps.map((step) => ({
        step,
        status: 'pending',
      }))
    )
  }

  const runNextStep = async () => {
    if (!selectedScenario || !currentSession) return

    const scenario = TEST_SCENARIOS[selectedScenario]
    const currentIndex = currentSession.currentStep

    if (currentIndex >= scenario.steps.length) return

    setIsRunning(true)

    // Update step status to running
    setStepStatuses((prev) =>
      prev.map((s, i) =>
        i === currentIndex ? { ...s, status: 'running', timestamp: new Date().toISOString() } : s
      )
    )

    // Simulate step execution (in real implementation, this would execute actual test actions)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mark step as completed
    setStepStatuses((prev) =>
      prev.map((s, i) => (i === currentIndex ? { ...s, status: 'completed' } : s))
    )

    // Update session
    const updatedSession: TestSession = {
      ...currentSession,
      currentStep: currentIndex + 1,
      completedSteps: [...currentSession.completedSteps, scenario.steps[currentIndex]],
    }
    setTestSession(updatedSession)
    setCurrentSession(updatedSession)
    setIsRunning(false)
  }

  const runAllSteps = async () => {
    if (!selectedScenario || !currentSession) return

    const scenario = TEST_SCENARIOS[selectedScenario]
    let stepIndex = currentSession.currentStep

    while (stepIndex < scenario.steps.length) {
      setIsRunning(true)

      // Update step status to running
      setStepStatuses((prev) =>
        prev.map((s, i) =>
          i === stepIndex ? { ...s, status: 'running', timestamp: new Date().toISOString() } : s
        )
      )

      // Simulate step execution
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mark step as completed
      setStepStatuses((prev) =>
        prev.map((s, i) => (i === stepIndex ? { ...s, status: 'completed' } : s))
      )

      stepIndex++

      // Update session
      const updatedSession: TestSession = {
        ...currentSession,
        currentStep: stepIndex,
        completedSteps: scenario.steps.slice(0, stepIndex),
      }
      setTestSession(updatedSession)
      setCurrentSession(updatedSession)
    }

    setIsRunning(false)
  }

  const resetScenario = () => {
    if (selectedScenario) {
      startScenario(selectedScenario)
    }
  }

  const navigateToTestFlow = (path: string) => {
    router.push(path)
  }

  const dataStats = {
    users: MOCK_USERS.length,
    resources: MOCK_RESOURCES.length,
    posts: MOCK_POSTS.length,
    applications: MOCK_APPLICATIONS.length,
    documents: MOCK_DOCUMENTS.length,
    reminders: MOCK_REMINDERS.length,
  }

  const getUserForScenario = (scenarioKey: ScenarioKey): MockUser | undefined => {
    const scenario = TEST_SCENARIOS[scenarioKey]
    return MOCK_USERS.find((u) => u.id === scenario.userId)
  }

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TestTube2 className="h-8 w-8" />
            FEED Test Harness
          </h1>
          <p className="text-muted-foreground mt-1">
            End-to-end testing environment with mock data
          </p>
        </div>
        <Button
          variant={testModeEnabled ? 'destructive' : 'default'}
          onClick={toggleTestMode}
          size="lg"
        >
          {testModeEnabled ? (
            <>
              <XCircle className="mr-2 h-5 w-5" />
              Disable Test Mode
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Enable Test Mode
            </>
          )}
        </Button>
      </div>

      {/* Test Mode Status Banner */}
      {testModeEnabled && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <TestTube2 className="h-5 w-5" />
            <span className="font-medium">Test Mode Active</span>
            <span className="text-amber-600 dark:text-amber-400">
              - Using mock data. No real database operations.
            </span>
          </div>
        </div>
      )}

      {/* Mock Data Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Mock Data Overview
          </CardTitle>
          <CardDescription>
            Available test data for all user flows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{dataStats.users}</div>
                <div className="text-sm text-muted-foreground">Users</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <MapPin className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{dataStats.resources}</div>
                <div className="text-sm text-muted-foreground">Resources</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <MessageSquare className="h-8 w-8 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{dataStats.posts}</div>
                <div className="text-sm text-muted-foreground">Posts</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{dataStats.applications}</div>
                <div className="text-sm text-muted-foreground">Applications</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-cyan-500" />
              <div>
                <div className="text-2xl font-bold">{dataStats.documents}</div>
                <div className="text-sm text-muted-foreground">Documents</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Bell className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{dataStats.reminders}</div>
                <div className="text-sm text-muted-foreground">Reminders</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Scenarios */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Scenario Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Test Scenarios</CardTitle>
            <CardDescription>
              Select a scenario to run end-to-end tests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(TEST_SCENARIOS) as ScenarioKey[]).map((key) => {
              const scenario = TEST_SCENARIOS[key]
              const user = getUserForScenario(key)
              const isActive = selectedScenario === key

              return (
                <button
                  key={key}
                  onClick={() => startScenario(key)}
                  disabled={!testModeEnabled}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  } ${!testModeEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {scenario.description}
                      </div>
                      {user && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{user.profile.full_name}</span>
                          <span className="mx-1">•</span>
                          <span>{user.email}</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      className={`h-5 w-5 text-muted-foreground transition-transform ${
                        isActive ? 'rotate-90' : ''
                      }`}
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {scenario.steps.length} steps
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {/* Step Execution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Scenario Steps</span>
              {selectedScenario && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetScenario}
                    disabled={isRunning}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    onClick={runNextStep}
                    disabled={
                      isRunning ||
                      !currentSession ||
                      currentSession.currentStep >= TEST_SCENARIOS[selectedScenario].steps.length
                    }
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Next
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={runAllSteps}
                    disabled={
                      isRunning ||
                      !currentSession ||
                      currentSession.currentStep >= TEST_SCENARIOS[selectedScenario].steps.length
                    }
                  >
                    Run All
                  </Button>
                </div>
              )}
            </CardTitle>
            <CardDescription>
              {selectedScenario
                ? `Running: ${selectedScenario.replace(/([A-Z])/g, ' $1').trim()}`
                : 'Select a scenario to begin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stepStatuses.length > 0 ? (
              <div className="space-y-2">
                {stepStatuses.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      step.status === 'completed'
                        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                        : step.status === 'running'
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                        : step.status === 'failed'
                        ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                        : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : step.status === 'running' ? (
                        <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : step.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{step.step}</div>
                      {step.timestamp && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Step {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TestTube2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Select a scenario to see test steps</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Navigation</CardTitle>
          <CardDescription>
            Jump to specific test flows in the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/feed')}
              disabled={!testModeEnabled}
            >
              <MessageSquare className="h-6 w-6" />
              <span>Feed</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/resources')}
              disabled={!testModeEnabled}
            >
              <MapPin className="h-6 w-6" />
              <span>Resources</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/forms')}
              disabled={!testModeEnabled}
            >
              <FileText className="h-6 w-6" />
              <span>Forms</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/chat')}
              disabled={!testModeEnabled}
            >
              <MessageSquare className="h-6 w-6" />
              <span>AI Chat</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/dashboard')}
              disabled={!testModeEnabled}
            >
              <Users className="h-6 w-6" />
              <span>Dashboard</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/applications')}
              disabled={!testModeEnabled}
            >
              <FileText className="h-6 w-6" />
              <span>Applications</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/documents')}
              disabled={!testModeEnabled}
            >
              <FileText className="h-6 w-6" />
              <span>Documents</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigateToTestFlow('/settings')}
              disabled={!testModeEnabled}
            >
              <User className="h-6 w-6" />
              <span>Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Users Quick Login */}
      {testModeEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Test Users</CardTitle>
            <CardDescription>
              Quick access to test user accounts (auto-login in test mode)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOCK_USERS.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{user.profile.full_name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {user.profile.city}, {user.profile.state}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            user.secureProfile.employment_status === 'employed'
                              ? 'bg-green-100 text-green-700'
                              : user.secureProfile.employment_status === 'unemployed'
                              ? 'bg-red-100 text-red-700'
                              : user.secureProfile.employment_status === 'retired'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {user.secureProfile.employment_status}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          HH: {user.secureProfile.household_size}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3"
                    onClick={() => {
                      // In real implementation, this would set the mock user session
                      console.log('Login as:', user.email)
                    }}
                  >
                    Login as {user.profile.full_name.split(' ')[0]}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
