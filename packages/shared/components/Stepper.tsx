import { Check } from "lucide-react";

interface StepperProps {
  steps: string[];
  currentStep: number;
}

const Stepper = ({ steps, currentStep }: StepperProps) => (
  <div>
    <div className="flex items-center">
      {steps.map((_, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-initial">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "bg-primary/15 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1.5 rounded-full transition-colors ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
    <p className="text-xs font-medium text-muted-foreground mt-2">
      Step {currentStep + 1} of {steps.length}: <span className="text-foreground">{steps[currentStep]}</span>
    </p>
  </div>
);

export default Stepper;
