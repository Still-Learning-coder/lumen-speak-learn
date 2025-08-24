import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { Check, Star, Zap, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const Pricing = () => {
  const { user, profile } = useAuth();
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: 'Free',
      description: 'Perfect for getting started',
      price: { monthly: 0, yearly: 0 },
      features: [
        '5 questions per day',
        'Basic AI responses',
        'Community access',
        'Standard voice responses',
        'Public questions only'
      ],
      icon: Star,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      buttonVariant: 'outline' as const,
      popular: false
    },
    {
      name: 'Pro',
      description: 'For power users and professionals',
      price: { monthly: 19, yearly: 190 },
      features: [
        'Unlimited questions',
        'Advanced AI responses',
        'Priority expert access',
        'HD voice responses',
        'Private questions',
        'Expert consultations',
        'Advanced search',
        'Email support'
      ],
      icon: Zap,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      buttonVariant: 'default' as const,
      popular: true
    },
    {
      name: 'Enterprise',
      description: 'For teams and organizations',
      price: { monthly: 99, yearly: 990 },
      features: [
        'Everything in Pro',
        'Team collaboration',
        'Custom AI training',
        'API access',
        'Priority support',
        'Custom integrations',
        'Analytics dashboard',
        'Dedicated expert pool'
      ],
      icon: Crown,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      buttonVariant: 'outline' as const,
      popular: false
    }
  ];

  const handleSubscribe = (planName: string) => {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }
    
    if (planName === 'Free') {
      toast.info('You\'re already on the free plan!');
      return;
    }

    toast.info(`${planName} subscription coming soon!`);
  };

  const getCurrentPlan = () => {
    if (!profile) return 'Free';
    if (profile.premium_until && new Date(profile.premium_until) > new Date()) {
      return 'Pro'; // Simplified - would need to check actual subscription details
    }
    return 'Free';
  };

  const currentPlan = getCurrentPlan();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold gradient-text mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Unlock the full power of AI-assisted learning and expert knowledge
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm ${!isYearly ? 'font-semibold' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <span className={`text-sm ${isYearly ? 'font-semibold' : 'text-muted-foreground'}`}>
              Yearly
            </span>
            {isYearly && (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                <Sparkles className="h-3 w-3 mr-1" />
                Save 17%
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = isYearly ? plan.price.yearly : plan.price.monthly;
            const isCurrentPlan = currentPlan === plan.name;
            
            return (
              <Card 
                key={plan.name} 
                className={`relative transition-all hover:shadow-xl ${
                  plan.popular ? 'ring-2 ring-primary shadow-lg scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-8">
                  <div className={`w-12 h-12 mx-auto rounded-lg ${plan.bgColor} flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${plan.color}`} />
                  </div>
                  
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <p className="text-muted-foreground">{plan.description}</p>
                  
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${price}</span>
                    {price > 0 && (
                      <span className="text-muted-foreground">
                        /{isYearly ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  
                  {isYearly && price > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${(price / 12).toFixed(0)}/month billed annually
                    </p>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.buttonVariant}
                    className="w-full"
                    onClick={() => handleSubscribe(plan.name)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? 'Current Plan' : `Get ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Can I change my plan at any time?</h3>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">What happens to my data if I cancel?</h3>
                <p className="text-muted-foreground">
                  Your account will revert to the free plan, but all your questions and answers will remain accessible.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
                <p className="text-muted-foreground">
                  Yes, we offer a 30-day money-back guarantee for all paid plans. No questions asked.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;