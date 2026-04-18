import { useState, useMemo, useRef } from "react";
import { useActiveSelectedKeys, useFileDataStore, useFileUIStore } from "@/stores/file";
import { getFileTypeFromKey, downloadFile, getMissingChunkIndices, processBatch } from "@/lib/utils";
import { getFileDownloadUrl, getFileUrl, moveToTrash, toggleLike, uploadChunk } from "@/lib/api";
import { MAX_CONCURRENTS, binaryExtensions, DIRECT_DOWNLOAD_LIMIT } from "@/lib/types";
import { toast } from "sonner";
import { shouldBlur } from "@/lib/utils";
import { FileItem, FileType, MAX_CHUNK_SIZE } from "@shared/types";
import { useGeneralSettingsStore } from "@/stores/general-store";
import { usePreviewStore } from "@/stores/preview-store";


export function useFileCardActions(file: FileItem) {
  const {
    updateFileMetadata,
    moveToTrashLocal,
  } = useFileDataStore();
  
  const {
    toggleSelection,
  } = useFileUIStore();
  
  const { safeMode } = useGeneralSettingsStore();

  const { openPreview } = usePreviewStore();

  const selectedKeys = useActiveSelectedKeys();

  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);


  const isSelected = selectedKeys.includes(file.name);
  const fileType = useMemo(() => getFileTypeFromKey(file.name), [file.name]);
  const blur = shouldBlur({ safeMode, tags: file.metadata?.tags ?? [] });
  const isIncompleteUpload =
    file.metadata?.chunkInfo &&
    file.metadata.chunkInfo.uploadedIndices?.length !== file.metadata.chunkInfo.total;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelection(file.name, fileType);
  };

  const handleDelete = () => {
    if (!confirm(`确定删除文件 ${file.metadata?.fileName} ?`)) return;
    moveToTrash(file.name).then(() => {
      moveToTrashLocal(file);
      toast.success("已移入回收站");
    });
  };

  const handleCopyLink = () => {
    const url = getFileUrl(file.name);
    navigator.clipboard.writeText(url);
    toast.success("文件链接复制成功~");
  };
  
  const handleShare = () => {
    setShowShare(true);
  };

  const handleDownload = () => {
    const url = getFileDownloadUrl(file.name);
    void downloadFile(url, file.metadata).then((result) => {
      if (result.status === "cancelled") return;
    }).catch(() => {
      toast.error("下载失败");
    });
  };
  
  const handleView = () => {
    const url = getFileUrl(file.name);
    const fileName = file.metadata?.fileName?.toLowerCase() || "";
    const fileSize = file.metadata?.fileSize || 0;
    
    // 文本阅读器：如果是文档类型且不是已知的二进制格式
    if (
      fileType === FileType.Document && 
      !binaryExtensions.some(ext => fileName.endsWith(ext))
    ) {
      // 大文件直接触发下载
      if (fileSize > DIRECT_DOWNLOAD_LIMIT) {
        handleDownload();
        return;
      }
      openPreview(file, 'text');
      return;
    }

    // 视频预览（预览器支持流式播放，不需要改变）
    if (fileType === FileType.Video) {
      openPreview(file, 'video');
      return;
    }

    // 音频预览（预览器支持流式播放，不需要改变）
    if (fileType === FileType.Audio) {
      openPreview(file, 'audio');
      return;
    }
    
    // 其他类型（图片、PDF、压缩包等）
    // 大文件直接触发下载
    if (fileSize > DIRECT_DOWNLOAD_LIMIT) {
      handleDownload();
      return;
    }
    
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleEdit = () => {
    setShowEdit(true);
  };

  const handleEditSuccess = (updatedMetadata: any) => {
    updateFileMetadata(file.name, {
      ...file.metadata,
      ...updatedMetadata,
    });
  };

  const handleToggleLike = () => {
    toggleLike(file.name).then(() => {
      updateFileMetadata(file.name, {
        ...file.metadata,
        liked: !file.metadata.liked,
      });
    });
  };

  const handleResumeUpload = () => {
    inputRef.current?.click();
  };

  const handleResumeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !isIncompleteUpload) return;

    if (
      selectedFile.name !== file.metadata?.fileName ||
      selectedFile.size !== file.metadata?.fileSize
    ) {
      toast.error("文件不匹配");
      return;
    }

    setIsResuming(true);
    const chunkInfo = file.metadata.chunkInfo!;
    const totalChunks = chunkInfo.total;

    try {
      const chunkIndicesToUpload = getMissingChunkIndices(
        totalChunks,
        chunkInfo.uploadedIndices
      );

      await processBatch(
        chunkIndicesToUpload,
        async (chunkIndex) => {
          const start = chunkIndex * MAX_CHUNK_SIZE;
          const endPos = Math.min(start + MAX_CHUNK_SIZE, selectedFile.size);
          const chunkFile = selectedFile.slice(start, endPos);

          await uploadChunk(file.name, chunkIndex, chunkFile);
        },
        undefined,
        MAX_CONCURRENTS
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
      window.location.reload();
      toast.success(`上传成功`);
    } catch (error) {
      console.error("继续上传失败:", error);
      toast.error("继续上传失败");
    } finally {
      setIsResuming(false);
    }
  };

  return {
    // States
    isSelected,
    fileType,
    blur,
    isIncompleteUpload,
    showDetail,
    showEdit,
    showShare,
    isResuming,

    inputRef,
    
    // Actions
    setShowDetail,
    setShowEdit,
    setShowShare,
    handleSelect,
    handleDelete,
    handleCopyLink,
    handleShare,
    handleDownload,
    handleView,
    handleEdit,
    handleEditSuccess,
    handleToggleLike,
    handleResumeUpload,
    handleResumeFileSelect,
  };
}
