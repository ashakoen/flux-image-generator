"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UploadIcon, ImageIcon, Loader2Icon, SettingsIcon } from "lucide-react"

const FLUX_MODEL_ENDPOINT = "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions"

const DEFAULT_SETTINGS = {
  go_fast: true,
  guidance: 3.5,
  num_outputs: 1,
  aspect_ratio: "1:1",
  output_format: "webp",
  output_quality: 80,
  prompt_strength: 0.8,
  num_inference_steps: 28,
}

function normalizeSettings(strength: number) {
  return {
    ...DEFAULT_SETTINGS,
    guidance: 3 + strength * 2,
    prompt_strength: 0.6 + strength * 0.4,
    num_inference_steps: Math.round(20 + strength * 30),
  }
}

export default function Img2ImgFlux() {
  const [image, setImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [strength, setStrength] = useState(0.5)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [useFineTuned, setUseFineTuned] = useState(false)
  const [modelVersion, setModelVersion] = useState("")
  const { toast } = useToast()
  const abortControllerRef = useRef<AbortController | null>(null)
  const [predictionId, setPredictionId] = useState<string | null>(null)
  const [cancelUrl, setCancelUrl] = useState<string | null>(null)
  const [getUrl, setGetUrl] = useState<string | null>(null)

  useEffect(() => {
    const storedApiKey = localStorage.getItem("replicateApiKey")
    if (storedApiKey) {
      setApiKey(storedApiKey)
    }
  }, [])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const pollPrediction = async () => {
      if (getUrl && apiKey) {
        try {
          const response = await fetch("/api/replicate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apiKey,
              getUrl,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to get prediction status");
          }

          const data = await response.json();
          
          if (data.status === "succeeded" && data.output && data.output.length > 0) {
            setResult(data.output[0]);
            setLoading(false);
            if (intervalId) clearInterval(intervalId);
          } else if (data.status === "failed") {
            throw new Error("Prediction failed");
          }
        } catch (error) {
          console.error("Error polling prediction:", error);
          setLoading(false);
          if (intervalId) clearInterval(intervalId);
          toast({
            title: "Error",
            description: "Failed to get prediction result. Please try again.",
            variant: "destructive",
          });
        }
      }
    };

    if (loading && getUrl) {
      intervalId = setInterval(pollPrediction, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [loading, getUrl, apiKey, toast]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleApiKeySave = () => {
    localStorage.setItem("replicateApiKey", apiKey)
    setIsSettingsOpen(false)
    toast({
      title: "API Key Saved",
      description: "Your Replicate API key has been saved.",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!image && !prompt) {
      toast({
        title: "Error",
        description: "Please upload an image or enter a prompt.",
        variant: "destructive",
      })
      return
    }

    if (!apiKey) {
      toast({
        title: "Error",
        description: "Please set your Replicate API key in the settings.",
        variant: "destructive",
      })
      setIsSettingsOpen(true)
      return
    }

    setLoading(true)
    setResult(null)
    abortControllerRef.current = new AbortController()

    try {
      const settings = normalizeSettings(strength)
      const input = {
        prompt,
        ...settings,
      }

      if (image) {
        (input as any).image = image
      }

      const body = { input }

      const response = await fetch("/api/replicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey,
          body,
          modelEndpoint: FLUX_MODEL_ENDPOINT,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error("Failed to generate image")
      }

      const data = await response.json()
      setPredictionId(data.id)
      setCancelUrl(data.urls.cancel)
      setGetUrl(data.urls.get)
    } catch (error: unknown) {
      setLoading(false)
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: "Cancelled",
          description: "Image generation was cancelled.",
          variant: "default",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to generate image. Please check your settings and try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleCancel = async () => {
    if (cancelUrl && apiKey) {
      try {
        const response = await fetch("/api/replicate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey,
            cancelUrl,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to cancel prediction");
        }

        setLoading(false);
        toast({
          title: "Cancelled",
          description: "Image generation was cancelled.",
          variant: "default",
        });
      } catch (error) {
        console.error("Error cancelling prediction:", error);
        toast({
          title: "Error",
          description: "Failed to cancel image generation. Please try again.",
          variant: "destructive",
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <Card className="shadow-xl relative">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-purple-800">FLUX.1 Image Generator</CardTitle>
            <CardDescription className="text-center text-purple-600">
              Transform your images using AI-powered img2img technology
            </CardDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setIsSettingsOpen(true)}
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="image-upload" className="text-lg font-medium text-purple-700">
                  Upload Image
                </Label>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="image-upload"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-purple-300 border-dashed rounded-lg cursor-pointer bg-purple-50 hover:bg-purple-100 transition-colors duration-300 overflow-hidden"
                  >
                    <div className="flex flex-col items-center justify-center w-full h-full">
                      {image ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <img src={image} alt="Uploaded" className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadIcon className="w-10 h-10 mb-3 text-purple-500" />
                          <p className="mb-2 text-sm text-purple-600">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-purple-500">PNG, JPG or GIF (1:1 ratio recommended)</p>
                        </div>
                      )}
                    </div>
                    <Input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-lg font-medium text-purple-700">
                  Prompt
                </Label>
                <Input
                  id="prompt"
                  placeholder="Enter your prompt here..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full p-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="strength" className="text-lg font-medium text-purple-700">
                  Strength: {strength.toFixed(2)}
                </Label>
                <Slider
                  id="strength"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[strength]}
                  onValueChange={(value) => setStrength(value[0])}
                  className="w-full"
                />
              </div>
              <Button
                type={loading ? "button" : "submit"}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300"
                onClick={loading ? handleCancel : undefined}
              >
                {loading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> Cancel
                  </>
                ) : (
                  "Generate Image"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="w-full aspect-square bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Loader2Icon className="h-12 w-12 text-purple-500 animate-spin" />
            </div>
          ) : result ? (
            <img src={result} alt="Generated" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>API Key Settings</DialogTitle>
            <DialogDescription>
              Enter your Replicate API key. This will be stored securely in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="api-key" className="text-right">
                API Key
              </Label>
              <Input
                id="api-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleApiKeySave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}