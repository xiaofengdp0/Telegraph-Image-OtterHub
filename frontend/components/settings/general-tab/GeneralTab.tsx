"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  ShieldCheck, 
  Zap, 
  CloudSync, 
  CloudUpload,
  Info,
  ShieldAlert,
  FolderOpen,
  Trash2,
  RefreshCw,
  Download,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useGeneralSettingsStore } from "@/stores/general-store";
import { cn } from "@/lib/utils";
import {
  loadDirectoryHandle,
  clearDirectoryHandleCache,
  pickDownloadDirectoryForFirstTime,
} from "@/lib/utils/file";

export function GeneralTab() {
  const { 
    dataSaverThreshold, 
    setDataSaverThreshold, 
    nsfwDetection, 
    setNsfwDetection,
    fetchSettings,
    syncSettings
  } = useGeneralSettingsStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localThreshold, setLocalThreshold] = useState(dataSaverThreshold.toString());

  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [isDirLoading, setIsDirLoading] = useState(false);
  const [supportsFsApi, setSupportsFsApi] = useState(false);

  useEffect(() => {
    setSupportsFsApi(typeof window !== "undefined" && "showDirectoryPicker" in window);

    if (supportsFsApi) {
      loadCurrentDirectory();
    }
  }, [supportsFsApi]);

  useEffect(() => {
    setLocalThreshold(dataSaverThreshold.toString());
  }, [dataSaverThreshold]);

  useEffect(() => {
    const threshold = parseFloat(localThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold === dataSaverThreshold) {
      return;
    }

    const timer = setTimeout(() => {
      setDataSaverThreshold(threshold);
    }, 500);

    return () => clearTimeout(timer);
  }, [localThreshold, dataSaverThreshold, setDataSaverThreshold]);

  const loadCurrentDirectory = async () => {
    try {
      const handle = await loadDirectoryHandle();
      setCurrentDir(handle?.name || null);
    } catch {
      setCurrentDir(null);
    }
  };

  const handleChangeDirectory = async () => {
    setIsDirLoading(true);
    try {
      const result = await pickDownloadDirectoryForFirstTime();
      if (result) {
        setCurrentDir(result.dirName);
        toast.success(`下载目录已更改为: ${result.dirName}`);
      }
    } catch {
      toast.error("更改目录失败");
    } finally {
      setIsDirLoading(false);
    }
  };

  const handleClearDirectory = async () => {
    setIsDirLoading(true);
    try {
      await clearDirectoryHandleCache();
      setCurrentDir(null);
      toast.success("下载目录已清除，下次下载将重新选择");
    } catch {
      toast.error("清除目录失败");
    } finally {
      setIsDirLoading(false);
    }
  };

  // 从云端同步
  const handleFetchFromCloud = async () => {
    setIsSyncing(true);
    try {
      await fetchSettings();
      toast.success("同步成功");
    } catch (error) {
      toast.error("从云端同步失败");
    } finally {
      setIsSyncing(false);
    }
  };

  // 上传到云端
  const handleUploadToCloud = async () => {
    setIsUploading(true);
    try {
      await syncSettings();
      toast.success("备份成功");
    } catch (error) {
      toast.error("备份失败");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar space-y-6 pr-2">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold tracking-tight">常规设置</h2>
          <p className="text-sm text-muted-foreground">修改立即生效，支持手动云端同步</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFetchFromCloud}
            disabled={isSyncing}
            className="rounded-xl h-9"
          >
            <CloudSync className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
            从云端同步
          </Button>
          <Button
            size="sm"
            onClick={handleUploadToCloud}
            disabled={isUploading}
            className="rounded-xl h-9 shadow-sm"
          >
            <CloudUpload className={cn("h-4 w-4 mr-2", isUploading && "animate-spin")} />
            备份到云端
          </Button>
        </div>
      </div>

      <Separator className="opacity-50" />

      <div className="grid gap-6">
        {/* 1. 省流模式设置 */}
        <Card className="border border-border/40 shadow-sm bg-muted/10 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">图片加载策略</CardTitle>
            </div>
            <CardDescription>控制省流模式下的图片加载行为</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="threshold" className="text-sm font-medium">省流无图阈值</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="threshold"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={localThreshold}
                    onChange={(e) => setLocalThreshold(e.target.value)}
                    className="w-24 h-9 text-right font-mono text-xs rounded-lg bg-background/50"
                  />
                  MB
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5 bg-muted/30 p-2 rounded-lg border border-border/20">
                <Info className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
                当加载模式切换为“省流”时，文件大小超过此阈值的图片将不会被加载预览图。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. 上传安全设置 */}
        <Card className="border border-border/40 shadow-sm bg-muted/10 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-base">上传安全设置</CardTitle>
            </div>
            <CardDescription>配置上传时的安全检查行为</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">NSFW.js 自动检测</Label>
                  <p className="text-[11px] text-muted-foreground">上传图片前进行本地内容识别</p>
                </div>
                <Switch
                  checked={nsfwDetection}
                  onCheckedChange={setNsfwDetection}
                />
              </div>
              
              {!nsfwDetection && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold">注意：</span>
                    关闭检测后，上传速度将显著提升（减少 CPU 消耗），但系统将不再自动为违规内容标记 NSFW 标签。
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5 bg-muted/30 p-2 rounded-lg border border-border/20">
                <Info className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
                开启后，系统将在浏览器端使用 TensorFlow.js 对图片进行识别。这可能会消耗较多内存和 CPU。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 3. 下载目录管理 */}
        {supportsFsApi && (
          <Card className="border border-border/40 shadow-sm bg-muted/10 backdrop-blur-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Download className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-base">下载目录管理</CardTitle>
              </div>
              <CardDescription>管理批量下载文件的保存目录</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/20">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">当前下载目录</p>
                    <p className="text-xs text-muted-foreground">
                      {currentDir || "未设置"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeDirectory}
                    disabled={isDirLoading}
                    className="h-9"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isDirLoading ? "animate-spin" : ""}`} />
                    更改目录
                  </Button>
                  {currentDir && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearDirectory}
                      disabled={isDirLoading}
                      className="h-9"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      清除
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5 bg-muted/30 p-2 rounded-lg border border-border/20">
                <Info className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
                首次下载时会提示选择目录，建议先在下载目录中手动创建 OtterHub 文件夹并选中它。之后会自动使用已选目录；如果权限失效，下次下载时会重新提示选择。
              </p>
            </CardContent>
          </Card>
        )}

        {!supportsFsApi && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">下载功能受限</AlertTitle>
            <AlertDescription className="text-yellow-700">
              您的浏览器不支持 File System Access API，无法自定义下载目录。建议使用 Chrome 或 Edge 浏览器以获得最佳体验。
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
