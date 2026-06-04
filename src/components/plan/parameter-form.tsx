"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { planInputSchema, type PlanInput } from "@/lib/validation/plan-schema";
import OptionToggleItem from "./option-toggle-item";
import { WIZARD_STEPS } from "./wizard-steps";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ToggleGroup } from "@/components/ui/toggle-group";

function ParameterForm({ initialValues, onGenerate }: Props) {
  const tPlan = useTranslations("Plan");
  const tValidation = useTranslations("Validation");

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = WIZARD_STEPS[currentStepIndex];
  
  const form = useForm<PlanInput>({
    resolver: zodResolver(planInputSchema),
    defaultValues: {
      age: 30,
      sex: "male",
      weight: 75,
      height: 175,
      workMode: "sedentary",
      dailySteps: 5000,
      healthIssues: "",
      goal: "weight-loss",
      equipment: "none",
      frequency: 3,
      timePerSession: 60,
      experience: "beginner",
      ...initialValues,
    },
  });

  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;
  const progressValue = ((currentStepIndex + 1) / WIZARD_STEPS.length) * 100;

  const handleNext = async () => {
    const isValid = await form.trigger(currentStep.fields);
    if (isValid) {
      if (isLastStep) {
        onGenerate(form.getValues());
      } else {
        setCurrentStepIndex((prev) => prev + 1);
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{tPlan("title")}</CardTitle>
        <CardDescription>
          {tPlan("stepCount", { current: currentStepIndex + 1, total: WIZARD_STEPS.length })} - {tPlan(currentStep.titleKey as never)}
        </CardDescription>
        <Progress value={progressValue} className="mt-2" />
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
            {currentStep.id === "basics" && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("age")} ({field.value})</FormLabel>
                      <FormControl>
                        <Slider 
                          min={13} max={100} step={1} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.age?.message && tValidation(form.formState.errors.age.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("sex")}</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(val) => val && field.onChange(val)} className="flex-wrap justify-start">
                          <OptionToggleItem value="male">{tPlan("sex_male")}</OptionToggleItem>
                          <OptionToggleItem value="female">{tPlan("sex_female")}</OptionToggleItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage>{form.formState.errors.sex?.message && tValidation(form.formState.errors.sex.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("weight")} ({field.value})</FormLabel>
                      <FormControl>
                        <Slider 
                          min={30} max={300} step={1} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.weight?.message && tValidation(form.formState.errors.weight.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("height")} ({field.value})</FormLabel>
                      <FormControl>
                        <Slider 
                          min={100} max={250} step={1} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.height?.message && tValidation(form.formState.errors.height.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep.id === "lifestyle" && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="workMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("workMode")}</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(val) => val && field.onChange(val)} className="flex-wrap justify-start">
                          <OptionToggleItem value="sedentary">{tPlan("workMode_sedentary")}</OptionToggleItem>
                          <OptionToggleItem value="active">{tPlan("workMode_active")}</OptionToggleItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage>{form.formState.errors.workMode?.message && tValidation(form.formState.errors.workMode.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dailySteps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("dailySteps")}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.dailySteps?.message && tValidation(form.formState.errors.dailySteps.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep.id === "health" && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("goal")}</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(val) => val && field.onChange(val)} className="flex-wrap justify-start">
                          <OptionToggleItem value="weight-loss">{tPlan("goal_weight-loss")}</OptionToggleItem>
                          <OptionToggleItem value="muscle">{tPlan("goal_muscle")}</OptionToggleItem>
                          <OptionToggleItem value="strength">{tPlan("goal_strength")}</OptionToggleItem>
                          <OptionToggleItem value="health-relief">{tPlan("goal_health-relief")}</OptionToggleItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage>{form.formState.errors.goal?.message && tValidation(form.formState.errors.goal.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="healthIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("healthIssues")}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={tPlan("healthIssues_placeholder")} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.healthIssues?.message && tValidation(form.formState.errors.healthIssues.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {currentStep.id === "preferences" && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="equipment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("equipment")}</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(val) => val && field.onChange(val)} className="flex-wrap justify-start">
                          <OptionToggleItem value="none">{tPlan("equipment_none")}</OptionToggleItem>
                          <OptionToggleItem value="home">{tPlan("equipment_home")}</OptionToggleItem>
                          <OptionToggleItem value="gym">{tPlan("equipment_gym")}</OptionToggleItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage>{form.formState.errors.equipment?.message && tValidation(form.formState.errors.equipment.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("frequency")} ({field.value})</FormLabel>
                      <FormControl>
                        <Slider 
                          min={1} max={7} step={1} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.frequency?.message && tValidation(form.formState.errors.frequency.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timePerSession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("timePerSession")} ({field.value})</FormLabel>
                      <FormControl>
                        <Slider 
                          min={10} max={240} step={5} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])} 
                        />
                      </FormControl>
                      <FormMessage>{form.formState.errors.timePerSession?.message && tValidation(form.formState.errors.timePerSession.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="experience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tPlan("experience")}</FormLabel>
                      <FormControl>
                        <ToggleGroup type="single" value={field.value} onValueChange={(val) => val && field.onChange(val)} className="flex-wrap justify-start">
                          <OptionToggleItem value="beginner">{tPlan("experience_beginner")}</OptionToggleItem>
                          <OptionToggleItem value="intermediate">{tPlan("experience_intermediate")}</OptionToggleItem>
                          <OptionToggleItem value="advanced">{tPlan("experience_advanced")}</OptionToggleItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage>{form.formState.errors.experience?.message && tValidation(form.formState.errors.experience.message as never)}</FormMessage>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between">
        {currentStepIndex > 0 ? (
          <Button variant="outline" onClick={() => setCurrentStepIndex((p) => p - 1)}>
            {tPlan("back" as never)}
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleNext}>
          {isLastStep ? tPlan("generate") : tPlan("next")}
        </Button>
      </CardFooter>
    </Card>
  );
}

interface Props {
  initialValues?: Partial<PlanInput>;
  onGenerate: (values: PlanInput) => void;
}

export default ParameterForm;
