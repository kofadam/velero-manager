import React, { useState } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  Container,
  Stack,
  StepContent,
  Collapse,
  Alert,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  component: React.ReactNode;
  isValid?: boolean;
  isOptional?: boolean;
}

interface FormWizardProps {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  onComplete: (data: any) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  completedData?: any;
}

const FormWizard: React.FC<FormWizardProps> = ({
  title,
  subtitle,
  steps,
  onComplete,
  onCancel,
  loading = false,
  completedData = {},
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState<any>(completedData);
  const [submitting, setSubmitting] = useState(false);

  const currentStep = steps[activeStep];
  const isLastStep = activeStep === steps.length - 1;
  const isFirstStep = activeStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCompletedSteps((prev) => new Set(prev).add(activeStep));
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (isFirstStep) {
      onCancel();
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await onComplete(formData);
      setCompletedSteps((prev) => new Set(prev).add(activeStep));
    } catch (error) {
      console.error('Error completing wizard:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isStepCompleted = (step: number) => completedSteps.has(step);
  const isStepValid = (step: number) => {
    const wizardStep = steps[step];
    return wizardStep.isValid !== false;
  };

  const canProceed = isStepValid(activeStep);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ overflow: 'hidden' }}>
        {/* Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 4,
          }}
        >
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              {subtitle}
            </Typography>
          )}

          {/* Progress indicator */}
          <Box sx={{ mt: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">
                Step {activeStep + 1} of {steps.length}
              </Typography>
              <Typography variant="body2">
                {Math.round(((activeStep + 1) / steps.length) * 100)}% Complete
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={((activeStep + 1) / steps.length) * 100}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.3)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 'white',
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        </Box>

        {/* Stepper */}
        <Box sx={{ p: 4, pb: 2 }}>
          <Stepper
            activeStep={activeStep}
            orientation="horizontal"
            sx={{
              '& .MuiStepIcon-root.Mui-completed': {
                color: 'success.main',
              },
              '& .MuiStepIcon-root.Mui-active': {
                color: 'primary.main',
              },
            }}
          >
            {steps.map((step, index) => (
              <Step key={step.id} completed={isStepCompleted(index)}>
                <StepLabel
                  StepIconComponent={isStepCompleted(index) ? CheckCircleIcon : undefined}
                  optional={
                    step.isOptional ? <Typography variant="caption">Optional</Typography> : null
                  }
                >
                  <Typography variant="body2" fontWeight="medium">
                    {step.label}
                  </Typography>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Step Content */}
        <Box sx={{ px: 4, pb: 2 }}>
          <Collapse in={true}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                minHeight: 400,
                backgroundColor: 'grey.50',
              }}
            >
              {currentStep.description && (
                <Alert severity="info" sx={{ mb: 3 }}>
                  {currentStep.description}
                </Alert>
              )}

              {React.cloneElement(currentStep.component as React.ReactElement, {
                formData,
                setFormData,
                onValidation: (isValid: boolean) => {
                  // Update step validation status
                  steps[activeStep].isValid = isValid;
                },
              })}
            </Paper>
          </Collapse>
        </Box>

        {/* Action Buttons */}
        <Box
          sx={{
            p: 4,
            pt: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <Stack direction="row" spacing={2} justifyContent="space-between">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={handleBack}
              disabled={submitting}
              variant="outlined"
            >
              {isFirstStep ? 'Cancel' : 'Back'}
            </Button>

            <Stack direction="row" spacing={2}>
              {!isLastStep && (
                <Button
                  endIcon={<ArrowForwardIcon />}
                  onClick={handleNext}
                  disabled={!canProceed || submitting}
                  variant="contained"
                  size="large"
                >
                  Next
                </Button>
              )}

              {isLastStep && (
                <Button
                  onClick={handleComplete}
                  disabled={!canProceed || submitting}
                  variant="contained"
                  size="large"
                  sx={{
                    background: 'linear-gradient(45deg, #4caf50, #8bc34a)',
                    minWidth: 120,
                  }}
                >
                  {submitting ? 'Creating...' : 'Create'}
                </Button>
              )}
            </Stack>
          </Stack>
        </Box>

        {/* Loading overlay */}
        {submitting && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <Box textAlign="center">
              <LinearProgress sx={{ width: 200, mb: 2 }} />
              <Typography variant="body1">Processing your request...</Typography>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default FormWizard;
