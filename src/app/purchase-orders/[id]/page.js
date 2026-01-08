/**
 * Purchase Order Detail Page
 * Displays full purchase order details with supplier and PM actions
 *
 * Route: /purchase-orders/[id]
 */

"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { AppLayout } from "@/components/layout/app-layout"
import { LoadingSpinner, LoadingCard, LoadingOverlay } from "@/components/loading"
import { AuditTrail } from "@/components/audit-trail"
import { usePermissions } from "@/hooks/use-permissions"
import { ConfirmationModal } from "@/components/modals"
import { CloudinaryUploadWidget } from "@/components/uploads/cloudinary-upload-widget"
import { ImagePreview } from "@/components/uploads/image-preview"
import { useToast } from "@/components/toast"
import { CommunicationStatus } from "@/components/purchase-orders/CommunicationStatus"
import { EnhancedOrderStatus } from "@/components/purchase-orders/EnhancedOrderStatus"

function PurchaseOrderDetailPageContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const orderId = params?.id
  const action = searchParams.get("action")
  const { canAccess, user } = usePermissions()
  const toast = useToast()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [linkedRequest, setLinkedRequest] = useState(null)
  const [linkedMaterial, setLinkedMaterial] = useState(null)
  const [materialRequests, setMaterialRequests] = useState([])
  const [linkedMaterials, setLinkedMaterials] = useState([])
  const [availableCapital, setAvailableCapital] = useState(null)
  const [projectFinances, setProjectFinances] = useState(null)

  // Action states
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isModifying, setIsModifying] = useState(false)
  const [isFulfilling, setIsFulfilling] = useState(false)
  const [isCreatingMaterial, setIsCreatingMaterial] = useState(false)
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState(false)
  const [isApprovingModification, setIsApprovingModification] = useState(false)
  const [isRejectingModification, setIsRejectingModification] = useState(false)
  const [validatingCapital, setValidatingCapital] = useState(false)

  // Modals
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showModifyModal, setShowModifyModal] = useState(false)
  const [showFulfillModal, setShowFulfillModal] = useState(false)
  const [showConfirmDeliveryModal, setShowConfirmDeliveryModal] = useState(false)
  const [showRetryModal, setShowRetryModal] = useState(false)
  const [showAlternativesModal, setShowAlternativesModal] = useState(false)
  const [showApproveModificationModal, setShowApproveModificationModal] = useState(false)
  const [showRejectModificationModal, setShowRejectModificationModal] = useState(false)

  // Form data
  const [acceptData, setAcceptData] = useState({ supplierNotes: "", unitCost: "" })
  const [rejectData, setRejectData] = useState({ supplierNotes: "" })
  const [modifyData, setModifyData] = useState({
    quantityOrdered: "",
    unitCost: "",
    deliveryDate: "",
    notes: "",
  })
  const [retryData, setRetryData] = useState({
    adjustments: {
      unitCost: "",
      quantityOrdered: "",
      deliveryDate: "",
      terms: "",
      notes: "",
    },
    notes: "",
    communicationChannels: ["email"],
    sendImmediately: true,
  })

  // Alternative suppliers state
  const [alternativeSuppliers, setAlternativeSuppliers] = useState([])
  const [loadingAlternatives, setLoadingAlternatives] = useState(false)
  const [selectedAlternativeSuppliers, setSelectedAlternativeSuppliers] = useState([])
  const [alternativeSearchQuery, setAlternativeSearchQuery] = useState("")
  const [alternativeMode, setAlternativeMode] = useState("simple")
  const [alternativeDataQuality, setAlternativeDataQuality] = useState(0)
  const [filteredSuppliers, setFilteredSuppliers] = useState([]) // Client-side filtered list
  const [simpleList, setSimpleList] = useState([]) // Simple list for hybrid mode
  const [viewMode, setViewMode] = useState("recommended") // "recommended" or "all" for hybrid mode
  const [alternativesData, setAlternativesData] = useState({
    adjustments: {
      unitCost: "",
      quantityOrdered: "",
      deliveryDate: "",
      terms: "",
      notes: "",
    },
    notes: "",
    communicationChannels: ["email"],
    sendImmediately: true,
  })
  // Bulk order state
  const [isBulkOrderAlternative, setIsBulkOrderAlternative] = useState(false)
  const [rejectedMaterials, setRejectedMaterials] = useState([])
  const [materialAssignments, setMaterialAssignments] = useState([]) // [{ materialRequestId, suppliers: [{ supplierId, quantity?, adjustments }] }]
  const [fulfillData, setFulfillData] = useState({
    deliveryNoteFileUrl: "",
    actualQuantityDelivered: "",
    supplierNotes: "",
  })
  const [modificationApprovalData, setModificationApprovalData] = useState({
    approvalNotes: "",
    autoCommit: false,
  })
  const [modificationRejectionData, setModificationRejectionData] = useState({
    rejectionReason: "",
    revertToOriginal: true,
  })
  const [confirmDeliveryData, setConfirmDeliveryData] = useState({
    deliveryNoteFileUrl: "",
    actualQuantityDelivered: "",
    actualUnitCost: "",
    notes: "",
    materialQuantities: {}, // For bulk orders: { materialRequestId: quantity }
  })

  // Check if user has access to purchase orders
  useEffect(() => {
    if (user) {
      const userRole = user.role?.toLowerCase()
      if (userRole === "clerk" || userRole === "site_clerk") {
        toast.showError("You do not have permission to view purchase orders")
        router.push("/dashboard/clerk")
        return
      }
      if (!canAccess("view_purchase_orders")) {
        toast.showError("You do not have permission to view purchase orders")
        router.push("/dashboard")
        return
      }
    }
  }, [user, canAccess, router, toast])

  useEffect(() => {
    if (orderId && user && user.role?.toLowerCase() !== "clerk" && user.role?.toLowerCase() !== "site_clerk") {
      fetchOrder()
    } else if (!orderId) {
      setError("Invalid order ID")
      setLoading(false)
    }
  }, [orderId, user])

  useEffect(() => {
    if (action) {
      handleActionFromUrl(action)
    }
  }, [action, order])

  useEffect(() => {
    if (order?.materialRequestId) {
      fetchMaterialRequest(order.materialRequestId)
    }
    if (order?.linkedMaterialId) {
      fetchLinkedMaterial(order.linkedMaterialId)
    }
  }, [order?.materialRequestId, order?.linkedMaterialId])

  const fetchOrder = async () => {
    if (!orderId) {
      setError("Invalid order ID")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/purchase-orders/${orderId}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch purchase order")
      }

      setOrder(data.data)

      // Set material requests (for bulk orders)
      if (data.data.materialRequests && Array.isArray(data.data.materialRequests)) {
        setMaterialRequests(data.data.materialRequests)
        // For backward compatibility, set first request as linkedRequest
        if (data.data.materialRequests.length > 0) {
          setLinkedRequest(data.data.materialRequests[0])
        }
      } else if (data.data.materialRequest) {
        setLinkedRequest(data.data.materialRequest)
        setMaterialRequests([data.data.materialRequest])
      }

      // Set linked materials (for bulk orders)
      if (data.data.linkedMaterials && Array.isArray(data.data.linkedMaterials)) {
        setLinkedMaterials(data.data.linkedMaterials)
        // For backward compatibility, set first material as linkedMaterial
        if (data.data.linkedMaterials.length > 0) {
          setLinkedMaterial(data.data.linkedMaterials[0])
        }
      } else if (data.data.linkedMaterial) {
        setLinkedMaterial(data.data.linkedMaterial)
        setLinkedMaterials([data.data.linkedMaterial])
      }

      // Fetch available capital if user has permission
      if (data.data.projectId && canAccess("view_financing")) {
        fetchAvailableCapital(data.data.projectId)
      }

      // Pre-fill form data
      setAcceptData((prev) => ({ ...prev, unitCost: data.data.unitCost?.toString() || "" }))
      setModifyData({
        quantityOrdered: data.data.quantityOrdered?.toString() || "",
        unitCost: data.data.unitCost?.toString() || "",
        deliveryDate: data.data.deliveryDate ? new Date(data.data.deliveryDate).toISOString().split("T")[0] : "",
        notes: "",
      })
      setFulfillData((prev) => ({
        ...prev,
        actualQuantityDelivered: data.data.quantityOrdered?.toString() || "",
      }))
      setConfirmDeliveryData((prev) => ({
        ...prev,
        actualQuantityDelivered: data.data.quantityOrdered?.toString() || "",
        actualUnitCost: data.data.unitCost?.toString() || "",
      }))
    } catch (err) {
      setError(err.message)
      console.error("Fetch purchase order error:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMaterialRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/material-requests/${requestId}`)
      const data = await response.json()
      if (data.success) {
        setLinkedRequest(data.data)
      }
    } catch (err) {
      console.error("Error fetching material request:", err)
    }
  }

  const fetchLinkedMaterial = async (materialId) => {
    try {
      const response = await fetch(`/api/materials/${materialId}`)
      const data = await response.json()
      if (data.success) {
        setLinkedMaterial(data.data)
      }
    } catch (err) {
      console.error("Error fetching linked material:", err)
    }
  }

  const fetchAvailableCapital = async (projectId) => {
    if (!canAccess("view_financing")) return

    try {
      const response = await fetch(`/api/project-finances?projectId=${projectId}`)
      const data = await response.json()
      if (data.success) {
        const capital =
          data.data.availableCapital !== undefined ? data.data.availableCapital : data.data.capitalBalance || 0
        setAvailableCapital(capital)
        setProjectFinances(data.data)
      }
    } catch (err) {
      console.error("Error fetching available capital:", err)
    }
  }

  const handleActionFromUrl = (actionType) => {
    if (!order) return

    switch (actionType) {
      case "accept":
        if (order.status === "order_sent" || order.status === "order_modified") {
          setShowAcceptModal(true)
        }
        break
      case "reject":
        if (order.status === "order_sent" || order.status === "order_modified") {
          setShowRejectModal(true)
        }
        break
      case "modify":
        if (order.status === "order_sent") {
          setShowModifyModal(true)
        }
        break
      case "fulfill":
        if (order.status === "order_accepted") {
          setShowFulfillModal(true)
        }
        break
      case "create-material":
        if (order.status === "ready_for_delivery") {
          handleCreateMaterial()
        }
        break
      default:
        break
    }
  }

  const handleAccept = async () => {
    setIsAccepting(true)
    setValidatingCapital(true)

    try {
      const payload = {
        supplierNotes: acceptData.supplierNotes,
        ...(acceptData.unitCost && { unitCost: Number.parseFloat(acceptData.unitCost) }),
      }

      // Capital validation happens on server, but show loading
      const response = await fetch(`/api/purchase-orders/${orderId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to accept purchase order")
      }

      // Capital validation complete
      setValidatingCapital(false)

      await fetchOrder()
      setShowAcceptModal(false)
      setAcceptData({ supplierNotes: "", unitCost: "" })
      toast.showSuccess("Purchase order accepted successfully!")
    } catch (err) {
      toast.showError(err.message || "Failed to accept purchase order")
      console.error("Accept purchase order error:", err)
    } finally {
      setIsAccepting(false)
      setValidatingCapital(false)
    }
  }

  const handleReject = async () => {
    if (!rejectData.supplierNotes.trim()) {
      toast.showError("Rejection reason is required")
      return
    }

    setIsRejecting(true)
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierNotes: rejectData.supplierNotes.trim() }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to reject purchase order")
      }

      await fetchOrder()
      setShowRejectModal(false)
      setRejectData({ supplierNotes: "" })
      toast.showSuccess("Purchase order rejected successfully!")
    } catch (err) {
      toast.showError(err.message || "Failed to reject purchase order")
      console.error("Reject purchase order error:", err)
    } finally {
      setIsRejecting(false)
    }
  }

  const handleModify = async () => {
    setIsModifying(true)
    try {
      const supplierModifications = {}
      if (modifyData.quantityOrdered)
        supplierModifications.quantityOrdered = Number.parseFloat(modifyData.quantityOrdered)
      if (modifyData.unitCost) supplierModifications.unitCost = Number.parseFloat(modifyData.unitCost)
      if (modifyData.deliveryDate) supplierModifications.deliveryDate = modifyData.deliveryDate

      const response = await fetch(`/api/purchase-orders/${orderId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierModifications,
          supplierNotes: modifyData.notes,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to modify purchase order")
      }

      await fetchOrder()
      setShowModifyModal(false)
      setModifyData({ quantityOrdered: "", unitCost: "", deliveryDate: "", notes: "" })
      toast.showSuccess("Purchase order modification submitted successfully!")
    } catch (err) {
      toast.showError(err.message || "Failed to modify purchase order")
      console.error("Modify purchase order error:", err)
    } finally {
      setIsModifying(false)
    }
  }

  const handleRetry = async () => {
    // Validate at least one adjustment is made
    const hasAdjustments = Object.values(retryData.adjustments).some(
      (value) => value !== "" && value !== null && value !== undefined,
    )

    if (!hasAdjustments) {
      toast.showError("At least one adjustment must be made for retry")
      return
    }

    // Validate communication channels
    if (retryData.communicationChannels.length === 0) {
      toast.showError("At least one communication channel must be selected")
      return
    }

    setIsModifying(true) // Use existing loading state
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/retry-supplier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryData),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to retry purchase order")
      }

      await fetchOrder()
      setShowRetryModal(false)
      setRetryData({
        adjustments: {
          unitCost: "",
          quantityOrdered: "",
          deliveryDate: "",
          terms: "",
          notes: "",
        },
        notes: "",
        communicationChannels: ["email"],
        sendImmediately: true,
      })
      toast.showSuccess(`Purchase order retry #${data.data.retryCount} sent successfully!`)
    } catch (err) {
      toast.showError(err.message || "Failed to retry purchase order")
      console.error("Retry purchase order error:", err)
    } finally {
      setIsModifying(false)
    }
  }

  const handleFetchAlternatives = async (searchQuery = "") => {
    // Validate order ID
    if (!orderId) {
      toast.showError("Order ID is missing")
      return
    }

    setLoadingAlternatives(true)
    try {
      // Ensure searchQuery is a string (handle event objects or other types)
      let queryString = "";
      if (typeof searchQuery === "string") {
        queryString = searchQuery;
      } else if (searchQuery && typeof searchQuery === "object" && searchQuery.target) {
        // If it's an event object, ignore it and use empty string
        queryString = "";
      }

      // Build query parameters
      const params = new URLSearchParams({
        mode: alternativeMode || "simple",
        limit: "50",
      })

      if (queryString && typeof queryString === "string" && queryString.trim()) {
        // Sanitize search query (prevent injection)
        const sanitizedQuery = queryString.trim().slice(0, 100) // Limit length
        params.append("search", sanitizedQuery)
      }

      const response = await fetch(`/api/purchase-orders/${orderId}/alternatives?${params.toString()}`)

      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Network error" }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch alternative suppliers")
      }

      const suppliers = data.data.alternatives || []

      // Validate suppliers data
      if (!Array.isArray(suppliers)) {
        throw new Error("Invalid supplier data received")
      }

      const simpleListData = data.data.simpleList || []

      setAlternativeSuppliers(suppliers)
      setFilteredSuppliers(suppliers) // Initialize filtered list
      setSimpleList(simpleListData) // Set simple list for hybrid mode
      setAlternativeDataQuality(data.data.dataQuality || 0)
      setAlternativeMode(data.data.mode || "simple")

      // Handle bulk order data
      const isBulk = data.data.isBulkOrder === true
      setIsBulkOrderAlternative(isBulk)
      
      if (isBulk && data.data.rejectedMaterials && Array.isArray(data.data.rejectedMaterials)) {
        setRejectedMaterials(data.data.rejectedMaterials)
        // Initialize material assignments
        const initialAssignments = data.data.rejectedMaterials.map(material => ({
          materialRequestId: material.materialRequestId,
          materialName: material.materialName,
          quantity: material.quantity,
          unit: material.unit,
          unitCost: material.unitCost,
          totalCost: material.totalCost,
          suppliers: [], // Will be populated by user
        }))
        setMaterialAssignments(initialAssignments)
      } else {
        setRejectedMaterials([])
        setMaterialAssignments([])
      }

      // Set default view mode based on mode and data availability
      if (data.data.mode === "hybrid" && suppliers.length > 0) {
        setViewMode("recommended") // Show recommended by default in hybrid
      } else {
        setViewMode("all") // Show all for simple mode
      }

      setShowAlternativesModal(true)

      // Show success message if suppliers found
      if (suppliers.length > 0) {
        toast.showSuccess(`Found ${suppliers.length} alternative supplier${suppliers.length !== 1 ? "s" : ""}`)
      } else {
        toast.showInfo("No alternative suppliers found. You may need to add more suppliers to the system.")
      }
    } catch (err) {
      const errorMessage = err.message || "Failed to fetch alternative suppliers"
      toast.showError(errorMessage)
      console.error("Fetch alternatives error:", err)

      // Reset state on error
      setAlternativeSuppliers([])
      setFilteredSuppliers([])
      setSimpleList([])
      setAlternativeDataQuality(0)
      setViewMode("recommended")
    } finally {
      setLoadingAlternatives(false)
    }
  }

  const handleAlternativeSearch = async (e) => {
    e.preventDefault()
    await handleFetchAlternatives(alternativeSearchQuery)
  }

  // Helper functions for bulk order material assignments
  const addSupplierToMaterial = (materialRequestId, supplierId) => {
    setMaterialAssignments(prev => prev.map(assignment => {
      if (assignment.materialRequestId === materialRequestId) {
        // Check if supplier already exists
        const existingSupplier = assignment.suppliers.find(s => s.supplierId === supplierId)
        if (existingSupplier) {
          return assignment // Don't add duplicate
        }
        return {
          ...assignment,
          suppliers: [...assignment.suppliers, {
            supplierId,
            quantity: undefined, // Full quantity by default
            adjustments: {},
          }]
        }
      }
      return assignment
    }))
  }

  const removeSupplierFromMaterial = (materialRequestId, supplierId) => {
    setMaterialAssignments(prev => prev.map(assignment => {
      if (assignment.materialRequestId === materialRequestId) {
        return {
          ...assignment,
          suppliers: assignment.suppliers.filter(s => s.supplierId !== supplierId)
        }
      }
      return assignment
    }))
  }

  const updateMaterialSupplierQuantity = (materialRequestId, supplierId, quantity) => {
    setMaterialAssignments(prev => prev.map(assignment => {
      if (assignment.materialRequestId === materialRequestId) {
        return {
          ...assignment,
          suppliers: assignment.suppliers.map(s => 
            s.supplierId === supplierId 
              ? { ...s, quantity: quantity === '' ? undefined : quantity }
              : s
          )
        }
      }
      return assignment
    }))
  }

  const updateMaterialSupplierAdjustment = (materialRequestId, supplierId, adjustmentField, value) => {
    setMaterialAssignments(prev => prev.map(assignment => {
      if (assignment.materialRequestId === materialRequestId) {
        return {
          ...assignment,
          suppliers: assignment.suppliers.map(s => 
            s.supplierId === supplierId 
              ? { 
                  ...s, 
                  adjustments: { 
                    ...s.adjustments, 
                    [adjustmentField]: value === '' ? undefined : value 
                  } 
                }
              : s
          )
        }
      }
      return assignment
    }))
  }

  // Client-side filtering for instant feedback (while server search is processing)
  useEffect(() => {
    // Only filter when modal is open and we have suppliers
    if (!showAlternativesModal) {
      return
    }

    // Determine which list to filter based on view mode
    const sourceList =
      alternativeMode === "hybrid" && viewMode === "all" && simpleList.length > 0 ? simpleList : alternativeSuppliers

    if (!Array.isArray(sourceList)) {
      return
    }

    if (!alternativeSearchQuery || !alternativeSearchQuery.trim()) {
      setFilteredSuppliers(sourceList)
      return
    }

    const query = alternativeSearchQuery.toLowerCase().trim()
    const filtered = sourceList.filter(
      (supplier) =>
        supplier &&
        (supplier.name?.toLowerCase().includes(query) ||
          supplier.email?.toLowerCase().includes(query) ||
          supplier.phone?.includes(query) ||
          supplier.contactPerson?.toLowerCase().includes(query)),
    )
    setFilteredSuppliers(filtered)
  }, [alternativeSearchQuery, alternativeSuppliers, simpleList, viewMode, alternativeMode, showAlternativesModal])

  const handleSendAlternatives = async () => {
    // Validate order ID
    if (!orderId) {
      toast.showError("Order ID is missing")
      return
    }

    // Validate communication channels
    if (!alternativesData.communicationChannels || alternativesData.communicationChannels.length === 0) {
      toast.showError("At least one communication channel must be selected")
      return
    }

    // Validate communication channel values
    const validChannels = ["email", "sms", "push"]
    const invalidChannels = alternativesData.communicationChannels.filter((ch) => !validChannels.includes(ch))
    if (invalidChannels.length > 0) {
      toast.showError(`Invalid communication channels: ${invalidChannels.join(", ")}`)
      return
    }

    // Handle bulk vs single orders
    if (isBulkOrderAlternative) {
      // BULK ORDER VALIDATION
      // Validate that all rejected materials have at least one supplier assigned
      const unassignedMaterials = materialAssignments.filter(ma => 
        !ma.suppliers || ma.suppliers.length === 0
      )

      if (unassignedMaterials.length > 0) {
        toast.showError(`Please assign suppliers for all rejected materials. ${unassignedMaterials.length} material(s) still need supplier assignment.`)
        return
      }

      // Validate material assignments
      for (const assignment of materialAssignments) {
        for (const supplierAssignment of assignment.suppliers) {
          if (!supplierAssignment.supplierId) {
            toast.showError(`Invalid supplier assignment for material ${assignment.materialName}`)
            return
          }

          // Validate quantity if provided (for splits)
          if (supplierAssignment.quantity !== undefined && supplierAssignment.quantity !== null) {
            const qty = Number.parseFloat(supplierAssignment.quantity)
            if (isNaN(qty) || qty <= 0) {
              toast.showError(`Invalid quantity for material ${assignment.materialName}`)
              return
            }
            if (qty > assignment.quantity) {
              toast.showError(`Quantity cannot exceed ${assignment.quantity} for material ${assignment.materialName}`)
              return
            }
          }

          // Validate adjustments if provided
          if (supplierAssignment.adjustments) {
            if (supplierAssignment.adjustments.unitCost !== undefined) {
              const unitCost = Number.parseFloat(supplierAssignment.adjustments.unitCost)
              if (isNaN(unitCost) || unitCost < 0) {
                toast.showError(`Invalid unit cost for material ${assignment.materialName}`)
                return
              }
            }
            if (supplierAssignment.adjustments.deliveryDate) {
              const deliveryDate = new Date(supplierAssignment.adjustments.deliveryDate)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              if (deliveryDate < today) {
                toast.showError(`Delivery date must be in the future for material ${assignment.materialName}`)
                return
              }
            }
          }
        }
      }

      // Prepare material assignments for API
      const apiMaterialAssignments = materialAssignments.map(assignment => ({
        materialRequestId: assignment.materialRequestId,
        suppliers: assignment.suppliers.map(s => ({
          supplierId: s.supplierId,
          ...(s.quantity !== undefined && s.quantity !== null ? { quantity: Number.parseFloat(s.quantity) } : {}),
          adjustments: s.adjustments || {},
        }))
      }))

      setIsModifying(true)
      try {
        const response = await fetch(`/api/purchase-orders/${orderId}/alternatives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materialAssignments: apiMaterialAssignments,
            notes: alternativesData.notes,
            communicationChannels: alternativesData.communicationChannels,
            sendImmediately: alternativesData.sendImmediately,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to send alternative orders")
        }

        await fetchOrder()
        setShowAlternativesModal(false)
        setSelectedAlternativeSuppliers([])
        setAlternativeSuppliers([])
        setFilteredSuppliers([])
        setAlternativeSearchQuery("")
        setRejectedMaterials([])
        setMaterialAssignments([])
        setIsBulkOrderAlternative(false)
        setAlternativesData({
          adjustments: {
            unitCost: "",
            quantityOrdered: "",
            deliveryDate: "",
            terms: "",
            notes: "",
          },
          notes: "",
          communicationChannels: ["email"],
          sendImmediately: true,
        })
        toast.showSuccess(`Successfully sent ${data.data.alternativeOrders.length} alternative order${data.data.alternativeOrders.length !== 1 ? "s" : ""}!`)
      } catch (err) {
        toast.showError(err.message || "Failed to send alternative orders")
        console.error("Send alternatives error:", err)
      } finally {
        setIsModifying(false)
      }

    } else {
      // SINGLE ORDER VALIDATION (existing logic)
      // Validate supplier selection
      if (!selectedAlternativeSuppliers || selectedAlternativeSuppliers.length === 0) {
        toast.showError("Please select at least one alternative supplier")
        return
      }

      // Validate supplier IDs are valid ObjectIds
      const invalidIds = selectedAlternativeSuppliers.filter((id) => {
        try {
          return !id || !/^[0-9a-fA-F]{24}$/.test(id)
        } catch {
          return true
        }
      })

      if (invalidIds.length > 0) {
        toast.showError("Invalid supplier selection. Please refresh and try again.")
        return
      }

      // Validate at least one adjustment is made
      const hasAdjustments = Object.values(alternativesData.adjustments).some(
        (value) => value !== "" && value !== null && value !== undefined,
      )

      if (!hasAdjustments) {
        toast.showError("At least one adjustment must be made for alternative orders")
        return
      }

      // Validate adjustment values
      if (alternativesData.adjustments.unitCost && Number.parseFloat(alternativesData.adjustments.unitCost) < 0) {
        toast.showError("Unit cost cannot be negative")
        return
      }

      if (
        alternativesData.adjustments.quantityOrdered &&
        Number.parseFloat(alternativesData.adjustments.quantityOrdered) <= 0
      ) {
        toast.showError("Quantity must be greater than 0")
        return
      }

      if (alternativesData.adjustments.deliveryDate) {
        const deliveryDate = new Date(alternativesData.adjustments.deliveryDate)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (deliveryDate < today) {
          toast.showError("Delivery date must be in the future")
          return
        }
      }

      setIsModifying(true)
      try {
        const response = await fetch(`/api/purchase-orders/${orderId}/alternatives`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedSuppliers: selectedAlternativeSuppliers,
            adjustments: alternativesData.adjustments,
            notes: alternativesData.notes,
            communicationChannels: alternativesData.communicationChannels,
            sendImmediately: alternativesData.sendImmediately,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to send alternative orders")
        }

        await fetchOrder()
        setShowAlternativesModal(false)
        setSelectedAlternativeSuppliers([])
        setAlternativeSuppliers([])
        setFilteredSuppliers([])
        setAlternativeSearchQuery("")
        setRejectedMaterials([])
        setMaterialAssignments([])
        setIsBulkOrderAlternative(false)
        setAlternativesData({
          adjustments: {
            unitCost: "",
            quantityOrdered: "",
            deliveryDate: "",
            terms: "",
            notes: "",
          },
          notes: "",
          communicationChannels: ["email"],
          sendImmediately: true,
        })
        toast.showSuccess(`Successfully sent ${data.data.alternativeOrders.length} alternative order${data.data.alternativeOrders.length !== 1 ? "s" : ""}!`)
      } catch (err) {
        toast.showError(err.message || "Failed to send alternative orders")
        console.error("Send alternatives error:", err)
      } finally {
        setIsModifying(false)
      }
    }
  }

  const handleFulfill = async () => {
    if (!fulfillData.deliveryNoteFileUrl.trim()) {
      toast.showError("Delivery note is required to fulfill an order")
      return
    }

    setIsFulfilling(true)
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryNoteFileUrl: fulfillData.deliveryNoteFileUrl.trim(),
          actualQuantityDelivered: fulfillData.actualQuantityDelivered
            ? Number.parseFloat(fulfillData.actualQuantityDelivered)
            : undefined,
          supplierNotes: fulfillData.supplierNotes,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to fulfill purchase order")
      }

      await fetchOrder()
      setShowFulfillModal(false)
      setFulfillData({ deliveryNoteFileUrl: "", actualQuantityDelivered: "", supplierNotes: "" })
      toast.showSuccess("Purchase order fulfilled successfully!")
    } catch (err) {
      toast.showError(err.message || "Failed to fulfill purchase order")
      console.error("Fulfill purchase order error:", err)
    } finally {
      setIsFulfilling(false)
    }
  }

  const handleApproveModification = async () => {
    setIsApprovingModification(true)
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/approve-modification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalNotes: modificationApprovalData.approvalNotes,
          autoCommit: modificationApprovalData.autoCommit,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to approve modifications")
      }

      await fetchOrder()
      setShowApproveModificationModal(false)
      setModificationApprovalData({ approvalNotes: "", autoCommit: false })
      toast.showSuccess(data.data.message || "Modifications approved successfully!")
    } catch (err) {
      toast.showError(err.message || "Failed to approve modifications")
      console.error("Approve modification error:", err)
    } finally {
      setIsApprovingModification(false)
    }
  }

  const handleRejectModification = async () => {
    if (!modificationRejectionData.rejectionReason.trim()) {
      toast.showError("Rejection reason is required")
      return
    }

    setIsRejectingModification(true)
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/reject-modification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: modificationRejectionData.rejectionReason.trim(),
          revertToOriginal: modificationRejectionData.revertToOriginal,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to reject modifications")
      }

      await fetchOrder()
      setShowRejectModificationModal(false)
      setModificationRejectionData({ rejectionReason: "", revertToOriginal: true })
      toast.showSuccess(data.data.message || "Modifications rejected successfully!")
    } catch (err) {
      toast.showError(err.message || "Failed to reject modifications")
      console.error("Reject modification error:", err)
    } finally {
      setIsRejectingModification(false)
    }
  }

  const handleCreateMaterial = async () => {
    setIsCreatingMaterial(true)
    try {
      const response = await fetch(`/api/purchase-orders/${orderId}/create-material`, {
        method: "POST",
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to create material from purchase order")
      }

      await fetchOrder()
      toast.showSuccess("Material created from purchase order successfully!")
      if (data.data?._id) {
        router.push(`/items/${data.data._id}`)
      }
    } catch (err) {
      toast.showError(err.message || "Failed to create material")
      console.error("Create material error:", err)
    } finally {
      setIsCreatingMaterial(false)
    }
  }

  const handleConfirmDelivery = async () => {
    // Validate delivery note is provided
    if (!confirmDeliveryData.deliveryNoteFileUrl.trim()) {
      toast.showError("Delivery note is required to confirm delivery")
      return
    }

    // Validate quantity if provided
    if (
      confirmDeliveryData.actualQuantityDelivered &&
      Number.parseFloat(confirmDeliveryData.actualQuantityDelivered) <= 0
    ) {
      toast.showError("Actual quantity delivered must be greater than 0")
      return
    }

    // Validate unit cost if provided
    if (confirmDeliveryData.actualUnitCost && Number.parseFloat(confirmDeliveryData.actualUnitCost) < 0) {
      toast.showError("Actual unit cost cannot be negative")
      return
    }

    // Validate per-material quantities if provided (for bulk orders)
    if (order?.isBulkOrder && confirmDeliveryData.materialQuantities && Object.keys(confirmDeliveryData.materialQuantities).length > 0) {
      for (const [materialRequestId, quantity] of Object.entries(confirmDeliveryData.materialQuantities)) {
        if (quantity && Number.parseFloat(quantity) <= 0) {
          toast.showError(`Quantity for material ${materialRequestId} must be greater than 0`)
          return
        }
      }
    }

    setIsConfirmingDelivery(true)
    try {
      // Prepare materialQuantities array for bulk orders
      let materialQuantitiesArray = undefined
      if (order?.isBulkOrder && confirmDeliveryData.materialQuantities && Object.keys(confirmDeliveryData.materialQuantities).length > 0) {
        materialQuantitiesArray = Object.entries(confirmDeliveryData.materialQuantities)
          .filter(([_, quantity]) => {
            if (!quantity) return false
            const qtyStr = typeof quantity === 'string' ? quantity.trim() : String(quantity).trim()
            return qtyStr !== "" && !isNaN(Number.parseFloat(qtyStr))
          })
          .map(([materialRequestId, quantity]) => ({
            materialRequestId,
            quantity: Number.parseFloat(quantity),
          }))
      }

      const response = await fetch(`/api/purchase-orders/${orderId}/confirm-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryNoteFileUrl: confirmDeliveryData.deliveryNoteFileUrl.trim(),
          actualQuantityDelivered: confirmDeliveryData.actualQuantityDelivered
            ? Number.parseFloat(confirmDeliveryData.actualQuantityDelivered)
            : undefined,
          actualUnitCost: confirmDeliveryData.actualUnitCost
            ? Number.parseFloat(confirmDeliveryData.actualUnitCost)
            : undefined,
          materialQuantities: materialQuantitiesArray, // Per-material quantities for bulk orders
          notes: confirmDeliveryData.notes.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to confirm delivery")
      }

      await fetchOrder()
      setShowConfirmDeliveryModal(false)
      setConfirmDeliveryData({
        deliveryNoteFileUrl: "",
        actualQuantityDelivered: order.quantityOrdered?.toString() || "",
        actualUnitCost: order.unitCost?.toString() || "",
        notes: "",
        materialQuantities: {},
      })
      toast.showSuccess("Delivery confirmed! Material entries have been created automatically.")

      // If materials were created, show link to first material
      if (data.data?.materials && data.data.materials.length > 0) {
        const firstMaterial = data.data.materials[0]
        toast.showSuccess(`Material entry created. View it here.`, {
          action: {
            label: "View Material",
            onClick: () => router.push(`/items/${firstMaterial._id}`),
          },
        })
      }
    } catch (err) {
      toast.showError(err.message || "Failed to confirm delivery")
      console.error("Confirm delivery error:", err)
    } finally {
      setIsConfirmingDelivery(false)
    }
  }

  const handleRetryCommunication = async (channel) => {
    if (!orderId || !channel) {
      throw new Error("Order ID and channel are required")
    }

    const response = await fetch(`/api/purchase-orders/${orderId}/retry-communication`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel }),
    })

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || `Failed to retry ${channel} communication`)
    }

    // Refresh order to get updated communication status
    await fetchOrder()
    return data
  }

  const getStatusBadgeColor = (status) => {
    const colors = {
      order_sent: "bg-blue-100 text-blue-800",
      order_accepted: "bg-green-100 text-green-800",
      order_rejected: "bg-red-100 text-red-800",
      order_modified: "bg-yellow-100 text-yellow-800",
      ready_for_delivery: "bg-purple-100 text-purple-800",
      delivered: "bg-indigo-100 text-indigo-800",
      cancelled: "bg-gray-100 text-gray-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getFinancialStatusBadgeColor = (financialStatus) => {
    const colors = {
      not_committed: "bg-gray-100 text-gray-800",
      committed: "bg-orange-100 text-orange-800",
      fulfilled: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    }
    return colors[financialStatus] || "bg-gray-100 text-gray-800"
  }

  const formatDate = (date) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return "N/A"
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingCard />
        </div>
      </AppLayout>
    )
  }

  if (error || !order) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error || "Purchase order not found"}
          </div>
          <Link href="/purchase-orders" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
            ← Back to Purchase Orders
          </Link>
        </div>
      </AppLayout>
    )
  }

  const canAccept =
    canAccess("accept_purchase_order") && (order.status === "order_sent" || order.status === "order_modified")
  const canReject =
    canAccess("reject_purchase_order") && (order.status === "order_sent" || order.status === "order_modified")
  const canModify = canAccess("modify_purchase_order") && order.status === "order_sent"
  const canFulfill = canAccess("fulfill_purchase_order") && order.status === "order_accepted"
  const canCreateMaterial =
    canAccess("create_material_from_order") && order.status === "ready_for_delivery" && !order.linkedMaterialId
  // Owner/PM can confirm delivery when status is 'order_accepted' (suppliers don't have system access)
  const canConfirmDelivery =
    (canAccess("confirm_delivery") || canAccess("create_material_from_order")) &&
    order.status === "order_accepted" &&
    !order.linkedMaterialId &&
    (user?.role?.toLowerCase() === "owner" ||
      user?.role?.toLowerCase() === "pm" ||
      user?.role?.toLowerCase() === "project_manager")
  const canEdit = canAccess("edit_purchase_order")

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Loading Overlay */}
        <LoadingOverlay
          isLoading={
            isAccepting ||
            isRejecting ||
            isModifying ||
            isFulfilling ||
            isCreatingMaterial ||
            isConfirmingDelivery ||
            validatingCapital ||
            isApprovingModification ||
            isRejectingModification
          }
          message={
            isAccepting
              ? validatingCapital
                ? "Validating capital availability..."
                : "Accepting purchase order..."
              : isRejecting
                ? "Rejecting purchase order..."
                : isModifying
                  ? "Submitting modifications..."
                  : isFulfilling
                    ? "Fulfilling purchase order..."
                    : isConfirmingDelivery
                      ? "Confirming delivery and creating materials..."
                      : isCreatingMaterial
                        ? "Creating material entry..."
                        : isApprovingModification
                          ? "Approving modifications..."
                          : isRejectingModification
                            ? "Rejecting modifications..."
                            : "Processing..."
          }
          fullScreen={false}
        />
        {/* Header */}
        <div className="mb-8">
          <Link href="/purchase-orders" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to Purchase Orders
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
                  {order.purchaseOrderNumber}
                </h1>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(order.status)}`}
                >
                  {order.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown"}
                </span>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getFinancialStatusBadgeColor(order.financialStatus)}`}
                >
                  {order.financialStatus?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "N/A"}
                </span>
              </div>
              <p className="text-gray-700 mt-2">{order.materialName}</p>
            </div>
            <div className="flex gap-2">
              {canAccept && (
                <button
                  onClick={() => setShowAcceptModal(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                >
                  Accept
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                >
                  Reject
                </button>
              )}
              {canModify && (
                <button
                  onClick={() => setShowModifyModal(true)}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg transition"
                >
                  Modify
                </button>
              )}
              {canFulfill && (
                <button
                  onClick={() => setShowFulfillModal(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                >
                  Fulfill
                </button>
              )}
              {canConfirmDelivery && (
                <button
                  onClick={() => {
                    setConfirmDeliveryData({
                      deliveryNoteFileUrl: "",
                      actualQuantityDelivered: order.quantityOrdered?.toString() || "",
                      actualUnitCost: order.unitCost?.toString() || "",
                      notes: "",
                    })
                    setShowConfirmDeliveryModal(true)
                  }}
                  disabled={isConfirmingDelivery}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                >
                  {isConfirmingDelivery ? "Confirming..." : "Confirm Delivery"}
                </button>
              )}
              {canCreateMaterial && (
                <button
                  onClick={handleCreateMaterial}
                  disabled={isCreatingMaterial}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                >
                  {isCreatingMaterial ? "Creating..." : "Create Material"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Order Status with Performance Indicators */}
        {order && <EnhancedOrderStatus order={order} canManage={canEdit} onRefresh={() => fetchOrder()} />}

        {/* Workflow Status Section */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6 shadow-md mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">📋 Workflow Status & Next Steps</h3>
          {order.status === "order_sent" && (
            <div className="text-sm text-blue-800">
              <p className="mb-2">
                <strong>Current Status:</strong> Purchase order has been sent to supplier and is awaiting response.
              </p>
              <p>
                <strong>Next Step:</strong> Supplier should review the order and accept, reject, or propose
                modifications.
              </p>
            </div>
          )}
          {order.status === "order_accepted" && (
            <div className="text-sm text-green-800 bg-green-50 border-green-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Supplier has accepted the purchase order. Cost is now committed.
              </p>
              {canConfirmDelivery ? (
                <p>
                  <strong>Next Step:</strong> As Owner/PM, you can confirm delivery when materials arrive. This will
                  automatically create material entries.
                </p>
              ) : (
                <p>
                  <strong>Next Step:</strong> Supplier should fulfill the order by uploading delivery note and marking
                  as ready for delivery.
                </p>
              )}
            </div>
          )}
          {order.status === "order_rejected" && (
            <div className="text-sm text-red-800 bg-red-50 border-red-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Supplier has rejected the purchase order.
              </p>
              {order.supplierNotes && (
                <p className="mb-2">
                  <strong>Supplier Notes:</strong> {order.supplierNotes}
                </p>
              )}
              {order.rejectionReason && (
                <p className="mb-2">
                  <strong>Rejection Reason:</strong> {order.rejectionReason}{" "}
                  {order.rejectionSubcategory && `- ${order.rejectionSubcategory}`}
                </p>
              )}
              {order.isRetryable !== null && (
                <div
                  className={`mb-2 p-2 rounded ${order.isRetryable ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}
                >
                  <p>
                    <strong>Retry Assessment:</strong> {order.isRetryable ? "Retryable" : "Not Retryable"}
                  </p>
                  {order.retryRecommendation && (
                    <p className="text-xs mt-1">
                      <strong>Recommendation:</strong> {order.retryRecommendation}
                    </p>
                  )}
                </div>
              )}
              <div className="mt-3 space-y-2">
                {order.isRetryable && (order.retryCount || 0) < 3 && canEdit && (
                  <button
                    onClick={() => setShowRetryModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
                  >
                    Retry with Same Supplier
                  </button>
                )}
                {canEdit && (
                  <button
                    onClick={() => handleFetchAlternatives("")}
                    disabled={loadingAlternatives}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 mr-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAlternatives ? "Finding Suppliers..." : "Find Alternative Suppliers"}
                  </button>
                )}
                <button
                  onClick={() => router.push(`/purchase-orders/create?materialRequestId=${order.materialRequestId}`)}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Create New Order
                </button>
              </div>
            </div>
          )}
          {order.status === "order_modified" && (
            <div className="text-sm text-yellow-800 bg-yellow-50 border-yellow-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Supplier has proposed modifications to the purchase order.
              </p>
              <p>
                <strong>Next Step:</strong> PM/OWNER should review the proposed modifications and approve or reject
                them.
              </p>
            </div>
          )}
          {order.status === "ready_for_delivery" && !order.linkedMaterialId && (
            <div className="text-sm text-purple-800 bg-purple-50 border-purple-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Supplier has fulfilled the order and uploaded delivery note. Material
                entry has been automatically created.
              </p>
              <p>
                <strong>Next Step:</strong> CLERK should verify receipt of materials on site using the "Verify Receipt"
                button on the material detail page.
              </p>
              {order.linkedMaterialId && (
                <Link
                  href={`/items/${order.linkedMaterialId}`}
                  className="text-purple-700 hover:text-purple-900 underline mt-1 inline-block"
                >
                  View Material Entry →
                </Link>
              )}
            </div>
          )}
          {order.status === "ready_for_delivery" && order.linkedMaterialId && (
            <div className="text-sm text-purple-800 bg-purple-50 border-purple-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Supplier has fulfilled the order. Material entry has been created.
              </p>
              <p>
                <strong>Next Step:</strong> CLERK should verify receipt of materials on site.
              </p>
              <Link
                href={`/items/${order.linkedMaterialId}`}
                className="text-purple-700 hover:text-purple-900 underline mt-1 inline-block"
              >
                View Material Entry →
              </Link>
            </div>
          )}
          {order.status === "delivered" && (
            <div className="text-sm text-green-800 bg-green-50 border-green-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Delivery has been confirmed. Materials have been created.
              </p>
              {order.deliveryConfirmedBy && (
                <p className="mb-2">
                  <strong>Confirmed By:</strong> {order.deliveryConfirmedBy === user?._id ? 'You' : 'Owner/PM'}
                  {order.deliveryConfirmedAt && (
                    <span className="text-xs text-gray-600 ml-2">
                      on {new Date(order.deliveryConfirmedAt).toLocaleDateString()}
                    </span>
                  )}
                </p>
              )}
              {order.deliveryConfirmedNotes && (
                <p className="mb-2">
                  <strong>Notes:</strong> {order.deliveryConfirmedNotes}
                </p>
              )}
              {linkedMaterials && linkedMaterials.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2">
                    <strong>Created Materials:</strong> {linkedMaterials.length} material {linkedMaterials.length === 1 ? 'entry' : 'entries'} created
                  </p>
                  <div className="space-x-2 flex flex-wrap gap-2">
                    {linkedMaterials.slice(0, 3).map((material) => (
                      <Link
                        key={material._id}
                        href={`/items/${material._id}`}
                        className="text-green-700 hover:text-green-900 underline text-sm"
                      >
                        {material.name || material.materialName}
                      </Link>
                    ))}
                    {linkedMaterials.length > 3 && (
                      <span className="text-sm text-gray-600">and {linkedMaterials.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}
              {order.linkedMaterialId && !linkedMaterials?.length && (
                <div className="mt-3">
                  <Link
                    href={`/items/${order.linkedMaterialId}`}
                    className="text-green-700 hover:text-green-900 underline text-sm"
                  >
                    View Material Entry →
                  </Link>
                </div>
              )}
              <p className="mt-2">
                <strong>Next Step:</strong> Review and approve the created material entries. Verify quantities and costs match the delivery.
              </p>
            </div>
          )}
          {order.status === "cancelled" && (
            <div className="text-sm text-gray-800 bg-gray-50 border-gray-200 rounded p-3">
              <p className="mb-2">
                <strong>Current Status:</strong> Purchase order has been cancelled.
              </p>
              <p>
                <strong>Next Step:</strong> If materials are still needed, create a new purchase order.
              </p>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Batch Information (for bulk orders) */}
            {order.batch && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold text-blue-900 mb-2">Batch Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-blue-700">Batch Number</dt>
                    <dd className="mt-1 text-base text-blue-900">
                      {order.batch.batchNumber}
                      {order.batch.batchName && ` - ${order.batch.batchName}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-blue-700">Batch Status</dt>
                    <dd className="mt-1">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {order.batch.status?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </dd>
                  </div>
                  {order.batch._id && (
                    <div className="md:col-span-2">
                      <Link
                        href={`/material-requests/bulk/${order.batch._id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Batch Details →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Details</h2>

              {/* Bulk Order - Show Materials Table */}
              {order.isBulkOrder && order.materials && Array.isArray(order.materials) && order.materials.length > 0 ? (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Materials in this Order</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Total Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {order.materials.map((material, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {material.materialName}
                              {material.description && (
                                <div className="text-xs text-gray-500 mt-1">{material.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {material.quantity} {material.unit}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(material.unitCost)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {formatCurrency(material.totalCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan="3" className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                            Total:
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">
                            {formatCurrency(order.totalCost)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                /* Single Order - Show Standard Details */
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Material Name</dt>
                    <dd className="mt-1 text-base text-gray-900">{order.materialName}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Quantity Ordered</dt>
                    <dd className="mt-1 text-base text-gray-900">
                      {order.quantityOrdered} {order.unit}
                    </dd>
                  </div>
                  {order.description && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-700">Description</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.description}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Unit Cost</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatCurrency(order.unitCost)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-500">Total Cost</dt>
                    <dd className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(order.totalCost)}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Delivery Date</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.deliveryDate)}</dd>
                  </div>
                  {order.terms && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-700">Payment Terms</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.terms}</dd>
                    </div>
                  )}
                  {order.notes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-700">Notes</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {/* Financial Information */}
            {(order.totalCost || availableCapital !== null) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Information</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Total Cost</dt>
                    <dd className="mt-1 text-base font-semibold text-gray-900">{formatCurrency(order.totalCost)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Financial Status</dt>
                    <dd className="mt-1">
                      <span
                        className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getFinancialStatusBadgeColor(order.financialStatus)}`}
                      >
                        {order.financialStatus?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "N/A"}
                      </span>
                    </dd>
                  </div>
                  {availableCapital !== null && canAccess("view_financing") && (
                    <>
                      <div>
                        <dt className="text-sm font-semibold text-gray-700">Available Capital</dt>
                        <dd className="mt-1 text-base text-gray-900">{formatCurrency(availableCapital)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-semibold text-gray-700">Remaining After This Order</dt>
                        <dd
                          className={`mt-1 text-base font-semibold ${
                            availableCapital - order.totalCost < 0 ? "text-red-600" : "text-gray-900"
                          }`}
                        >
                          {formatCurrency(availableCapital - order.totalCost)}
                        </dd>
                      </div>
                    </>
                  )}
                  {order.financialStatus === "committed" && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-amber-600">Committed Cost Impact</dt>
                      <dd className="mt-1 text-base text-amber-700">
                        This order has committed {formatCurrency(order.totalCost)} from available capital. The cost will
                        be moved to actual when the material is created and approved.
                      </dd>
                    </div>
                  )}
                </dl>
                {order.totalCost && availableCapital !== null && order.totalCost > availableCapital && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800">
                      ⚠️ Warning: Total cost ({formatCurrency(order.totalCost)}) exceeds available capital (
                      {formatCurrency(availableCapital)}) by {formatCurrency(order.totalCost - availableCapital)}
                    </p>
                  </div>
                )}
                {projectFinances && projectFinances.materialsBreakdown && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Materials Budget Context</h3>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <dt className="text-gray-700">Budget</dt>
                        <dd className="font-semibold text-gray-900">
                          {formatCurrency(projectFinances.materialsBreakdown.budget || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-orange-600">Estimated</dt>
                        <dd className="font-semibold text-orange-700">
                          {formatCurrency(projectFinances.materialsBreakdown.estimated || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-amber-600">Committed</dt>
                        <dd className="font-semibold text-amber-700">
                          {formatCurrency(projectFinances.materialsBreakdown.committed || 0)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-green-600">Actual</dt>
                        <dd className="font-semibold text-green-700">
                          {formatCurrency(projectFinances.materialsBreakdown.actual || 0)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* Supplier Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Supplier Information</h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Supplier Name</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.supplierName || "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Supplier Email</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.supplierEmail || "N/A"}</dd>
                </div>
              </dl>
            </div>

            {/* Communication Status */}
            <CommunicationStatus
              order={order}
              onRetry={handleRetryCommunication}
              canRetry={canAccess("edit_purchase_order")}
            />

            {/* Supplier Response */}
            {order.supplierResponse && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Supplier Response</h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Response</dt>
                    <dd className="mt-1 text-base text-gray-900 capitalize">{order.supplierResponse}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Response Date</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.supplierResponseDate)}</dd>
                  </div>
                  {order.supplierNotes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-700">Supplier Notes</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.supplierNotes}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Supplier Modifications */}
            {order.supplierModifications && order.modificationApproved === undefined && (
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-yellow-900">Proposed Modifications</h2>
                  {canEdit && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowApproveModificationModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectModificationModal(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Original Values */}
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Original Values</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <dt className="text-gray-600">Quantity</dt>
                        <dd className="text-gray-900 font-medium">
                          {order.quantityOrdered} {order.unit}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Unit Cost</dt>
                        <dd className="text-gray-900 font-medium">{formatCurrency(order.unitCost)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Total Cost</dt>
                        <dd className="text-gray-900 font-medium">{formatCurrency(order.totalCost)}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-600">Delivery Date</dt>
                        <dd className="text-gray-900 font-medium">{formatDate(order.deliveryDate)}</dd>
                      </div>
                    </div>
                  </div>
                  {/* Proposed Values */}
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-semibold text-yellow-700 mb-2">Proposed Values</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {order.supplierModifications.quantityOrdered !== undefined && (
                        <div>
                          <dt className="text-gray-600">Quantity</dt>
                          <dd className="text-yellow-900 font-medium">
                            {order.supplierModifications.quantityOrdered} {order.unit}
                            {order.supplierModifications.quantityOrdered !== order.quantityOrdered && (
                              <span
                                className={`ml-2 text-xs ${
                                  order.supplierModifications.quantityOrdered > order.quantityOrdered
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                ({order.supplierModifications.quantityOrdered > order.quantityOrdered ? "+" : ""}
                                {(
                                  ((order.supplierModifications.quantityOrdered - order.quantityOrdered) /
                                    order.quantityOrdered) *
                                  100
                                ).toFixed(1)}
                                %)
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                      {order.supplierModifications.unitCost !== undefined && (
                        <div>
                          <dt className="text-gray-600">Unit Cost</dt>
                          <dd className="text-yellow-900 font-medium">
                            {formatCurrency(order.supplierModifications.unitCost)}
                            {order.supplierModifications.unitCost !== order.unitCost && (
                              <span
                                className={`ml-2 text-xs ${
                                  order.supplierModifications.unitCost < order.unitCost
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                ({order.supplierModifications.unitCost < order.unitCost ? "-" : "+"}
                                {Math.abs(
                                  ((order.supplierModifications.unitCost - order.unitCost) / order.unitCost) * 100,
                                ).toFixed(1)}
                                %)
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                      {order.supplierModifications.unitCost !== undefined ||
                      order.supplierModifications.quantityOrdered !== undefined ? (
                        <div>
                          <dt className="text-gray-600">New Total</dt>
                          <dd className="text-yellow-900 font-medium">
                            {formatCurrency(
                              (order.supplierModifications.quantityOrdered || order.quantityOrdered) *
                                (order.supplierModifications.unitCost !== undefined
                                  ? order.supplierModifications.unitCost
                                  : order.unitCost),
                            )}
                          </dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="text-gray-600">Total Cost</dt>
                          <dd className="text-yellow-900 font-medium">{formatCurrency(order.totalCost)}</dd>
                        </div>
                      )}
                      {order.supplierModifications.deliveryDate && (
                        <div>
                          <dt className="text-gray-600">Delivery Date</dt>
                          <dd className="text-yellow-900 font-medium">
                            {formatDate(order.supplierModifications.deliveryDate)}
                            {new Date(order.supplierModifications.deliveryDate).getTime() !==
                              new Date(order.deliveryDate).getTime() && (
                              <span
                                className={`ml-2 text-xs ${
                                  new Date(order.supplierModifications.deliveryDate) > new Date(order.deliveryDate)
                                    ? "text-yellow-600"
                                    : "text-green-600"
                                }`}
                              >
                                (
                                {new Date(order.supplierModifications.deliveryDate) > new Date(order.deliveryDate)
                                  ? "Later"
                                  : "Earlier"}
                                )
                              </span>
                            )}
                          </dd>
                        </div>
                      )}
                    </div>
                  </div>
                  {order.supplierModifications.notes && (
                    <div className="md:col-span-2">
                      <dt className="text-sm font-semibold text-gray-700">Modification Notes</dt>
                      <dd className="mt-1 text-base text-gray-900">{order.supplierModifications.notes}</dd>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Modification Approval Status */}
            {order.modificationApproved !== undefined && (
              <div
                className={`bg-white rounded-lg shadow p-6 border-l-4 ${
                  order.modificationApproved ? "border-green-500" : "border-red-500"
                }`}
              >
                <h2 className="text-xl font-bold mb-2">
                  {order.modificationApproved ? "Modifications Approved" : "Modifications Rejected"}
                </h2>
                <p className="text-sm text-gray-600">
                  {order.modificationApprovedAt && `On ${formatDate(order.modificationApprovedAt)}`}
                  {order.modificationApprovedBy && ` by ${order.modificationApprovedByName || "PM/OWNER"}`}
                </p>
                {order.modificationApprovalNotes && (
                  <p className="mt-2 text-sm text-gray-700">{order.modificationApprovalNotes}</p>
                )}
                {order.modificationRejectionReason && (
                  <p className="mt-2 text-sm text-red-700">{order.modificationRejectionReason}</p>
                )}
              </div>
            )}

            {/* Delivery Note */}
            {order.deliveryNoteFileUrl && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Delivery Note</h2>
                <ImagePreview imageUrl={order.deliveryNoteFileUrl} alt="Delivery Note" />
              </div>
            )}

            {/* Linked Material Requests */}
            {materialRequests.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {materialRequests.length > 1 ? "Linked Material Requests" : "Linked Material Request"}
                </h2>
                {materialRequests.length > 1 ? (
                  <div className="space-y-3">
                    {materialRequests.map((request) => (
                      <div
                        key={request._id}
                        className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                      >
                        <div>
                          <p className="text-base font-semibold text-gray-900">{request.requestNumber}</p>
                          <p className="text-sm text-gray-700 mt-1">{request.materialName}</p>
                        </div>
                        <Link
                          href={`/material-requests/${request._id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          View →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{materialRequests[0].requestNumber}</p>
                      <p className="text-sm text-gray-700 mt-1">{materialRequests[0].materialName}</p>
                    </div>
                    <Link
                      href={`/material-requests/${materialRequests[0]._id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Request →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Linked Material Entries */}
            {linkedMaterials.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {linkedMaterials.length > 1 ? "Linked Material Entries" : "Linked Material Entry"}
                </h2>
                {linkedMaterials.length > 1 ? (
                  <div className="space-y-3">
                    {linkedMaterials.map((material) => (
                      <div
                        key={material._id}
                        className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                      >
                        <div>
                          <p className="text-base font-semibold text-gray-900">
                            {material.name || material.materialName}
                          </p>
                          <p className="text-sm text-gray-700 mt-1">
                            Status:{" "}
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(material.status)}`}
                            >
                              {material.status?.replace(/_/g, " ")}
                            </span>
                          </p>
                        </div>
                        <Link
                          href={`/items/${material._id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          View →
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {linkedMaterials[0].name || linkedMaterials[0].materialName}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">
                        Status:{" "}
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(linkedMaterials[0].status)}`}
                        >
                          {linkedMaterials[0].status?.replace(/_/g, " ")}
                        </span>
                      </p>
                    </div>
                    <Link
                      href={`/items/${linkedMaterials[0]._id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Material →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Activity Log</h2>
              <AuditTrail entityType="PURCHASE_ORDER" entityId={orderId} projectId={order.projectId?.toString()} />
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Order Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Information</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Order Number</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.purchaseOrderNumber}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Created By</dt>
                  <dd className="mt-1 text-base text-gray-900">{order.createdByName || "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Sent At</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(order.sentAt || order.createdAt)}</dd>
                </div>
                {order.committedAt && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Committed At</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.committedAt)}</dd>
                  </div>
                )}
                {order.fulfilledAt && (
                  <div>
                    <dt className="text-sm font-semibold text-gray-700">Fulfilled At</dt>
                    <dd className="mt-1 text-base text-gray-900">{formatDate(order.fulfilledAt)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-semibold text-gray-700">Last Updated</dt>
                  <dd className="mt-1 text-base text-gray-900">{formatDate(order.updatedAt)}</dd>
                </div>
              </dl>
            </div>

            {/* Project Information */}
            {order.projectId && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Project</h2>
                <Link href={`/projects/${order.projectId}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  View Project →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        {/* Accept Modal */}
        <ConfirmationModal
          isOpen={showAcceptModal}
          onClose={() => {
            if (!isAccepting) {
              setShowAcceptModal(false)
              setAcceptData({ supplierNotes: "", unitCost: order.unitCost?.toString() || "" })
            }
          }}
          onConfirm={handleAccept}
          title="Accept Purchase Order"
          message="Confirm that you accept this purchase order. You can adjust the final unit cost if needed."
          confirmText="Accept Order"
          cancelText="Cancel"
          confirmColor="green"
          isLoading={isAccepting}
        >
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Final Unit Cost (Optional)
              </label>
              <input
                type="number"
                value={acceptData.unitCost}
                onChange={(e) => setAcceptData((prev) => ({ ...prev, unitCost: e.target.value }))}
                min="0"
                step="0.01"
                placeholder={order.unitCost?.toString() || "0.00"}
                disabled={isAccepting}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-sm text-gray-700 mt-1">Leave empty to use original unit cost</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Supplier Notes (Optional)
              </label>
              <textarea
                value={acceptData.supplierNotes}
                onChange={(e) => setAcceptData((prev) => ({ ...prev, supplierNotes: e.target.value }))}
                rows={3}
                disabled={isAccepting}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500"
                placeholder="Add any notes about this acceptance..."
              />
            </div>

            {/* Capital Validation Indicator */}
            {validatingCapital && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" color="blue-600" />
                  <span>Validating capital availability...</span>
                </div>
              </div>
            )}
          </div>
        </ConfirmationModal>

        {/* Reject Modal */}
        <ConfirmationModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false)
            setRejectData({ supplierNotes: "" })
          }}
          onConfirm={handleReject}
          title="Reject Purchase Order"
          message="Please provide a reason for rejecting this purchase order."
          confirmText="Reject Order"
          cancelText="Cancel"
          confirmColor="red"
        >
          <div className="mt-4">
            <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
              Rejection Reason *
            </label>
            <textarea
              value={rejectData.supplierNotes}
              onChange={(e) => setRejectData((prev) => ({ ...prev, supplierNotes: e.target.value }))}
              rows={3}
              required
              className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-500"
              placeholder="Explain why you are rejecting this order..."
            />
          </div>
        </ConfirmationModal>

        {/* Modify Modal */}
        <ConfirmationModal
          isOpen={showModifyModal}
          onClose={() => {
            setShowModifyModal(false)
            setModifyData({
              quantityOrdered: order.quantityOrdered?.toString() || "",
              unitCost: order.unitCost?.toString() || "",
              deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split("T")[0] : "",
              notes: "",
            })
          }}
          onConfirm={handleModify}
          title="Propose Modifications"
          message="Propose changes to this purchase order. PM/OWNER will review and approve or reject your modifications."
          confirmText="Submit Modifications"
          cancelText="Cancel"
          confirmColor="yellow"
        >
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Proposed Quantity
                </label>
                <input
                  type="number"
                  value={modifyData.quantityOrdered}
                  onChange={(e) => setModifyData((prev) => ({ ...prev, quantityOrdered: e.target.value }))}
                  min="0.01"
                  step="0.01"
                  placeholder={order.quantityOrdered?.toString() || ""}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Proposed Unit Cost
                </label>
                <input
                  type="number"
                  value={modifyData.unitCost}
                  onChange={(e) => setModifyData((prev) => ({ ...prev, unitCost: e.target.value }))}
                  min="0"
                  step="0.01"
                  placeholder={order.unitCost?.toString() || ""}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 placeholder:text-gray-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Proposed Delivery Date
              </label>
              <input
                type="date"
                value={modifyData.deliveryDate}
                onChange={(e) => setModifyData((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Modification Notes
              </label>
              <textarea
                value={modifyData.notes}
                onChange={(e) => setModifyData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 placeholder:text-gray-500"
                placeholder="Explain the proposed changes..."
              />
            </div>
          </div>
        </ConfirmationModal>

        {/* Fulfill Modal */}
        <ConfirmationModal
          isOpen={showFulfillModal}
          onClose={() => {
            setShowFulfillModal(false)
            setFulfillData({
              deliveryNoteFileUrl: "",
              actualQuantityDelivered: order.quantityOrdered?.toString() || "",
              supplierNotes: "",
            })
          }}
          onConfirm={handleFulfill}
          title="Fulfill Purchase Order"
          message="Upload delivery note and confirm fulfillment. This will mark the order as ready for material entry."
          confirmText="Fulfill Order"
          cancelText="Cancel"
          confirmColor="purple"
        >
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Delivery Note *</label>
              <CloudinaryUploadWidget
                value={fulfillData.deliveryNoteFileUrl}
                onChange={(url) => setFulfillData((prev) => ({ ...prev, deliveryNoteFileUrl: url }))}
                onDelete={() => setFulfillData((prev) => ({ ...prev, deliveryNoteFileUrl: "" }))}
                folder="purchase-orders/delivery-notes"
              />
              {fulfillData.deliveryNoteFileUrl && (
                <div className="mt-2">
                  <ImagePreview imageUrl={fulfillData.deliveryNoteFileUrl} alt="Delivery Note" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Actual Quantity Delivered (Optional)
              </label>
              <input
                type="number"
                value={fulfillData.actualQuantityDelivered}
                onChange={(e) => setFulfillData((prev) => ({ ...prev, actualQuantityDelivered: e.target.value }))}
                min="0.01"
                step="0.01"
                placeholder={order.quantityOrdered?.toString() || ""}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500"
              />
              <p className="text-sm text-gray-700 mt-1">Leave empty to use ordered quantity</p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Supplier Notes (Optional)
              </label>
              <textarea
                value={fulfillData.supplierNotes}
                onChange={(e) => setFulfillData((prev) => ({ ...prev, supplierNotes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500"
                placeholder="Add any notes about the delivery..."
              />
            </div>
          </div>
        </ConfirmationModal>

        {/* Confirm Delivery Modal */}
        <ConfirmationModal
          isOpen={showConfirmDeliveryModal}
          onClose={() => {
            setShowConfirmDeliveryModal(false)
            setConfirmDeliveryData({
              deliveryNoteFileUrl: "",
              actualQuantityDelivered: order.quantityOrdered?.toString() || "",
              actualUnitCost: order.unitCost?.toString() || "",
              notes: "",
              materialQuantities: {},
            })
          }}
          onConfirm={handleConfirmDelivery}
          title="Confirm Delivery"
          message="Upload delivery note and confirm delivery. This will automatically create material entries and mark the order as delivered."
          confirmText="Confirm Delivery"
          cancelText="Cancel"
          confirmColor="green"
        >
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">Delivery Note *</label>
              <CloudinaryUploadWidget
                value={confirmDeliveryData.deliveryNoteFileUrl}
                onChange={(url) => setConfirmDeliveryData((prev) => ({ ...prev, deliveryNoteFileUrl: url }))}
                onDelete={() => setConfirmDeliveryData((prev) => ({ ...prev, deliveryNoteFileUrl: "" }))}
                folder="purchase-orders/delivery-notes"
              />
              {confirmDeliveryData.deliveryNoteFileUrl && (
                <div className="mt-2">
                  <ImagePreview imageUrl={confirmDeliveryData.deliveryNoteFileUrl} alt="Delivery Note" />
                </div>
              )}
              <p className="text-sm text-gray-600 mt-1">Upload the delivery note or receipt from the supplier</p>
            </div>
            {order?.isBulkOrder && order?.materials && Array.isArray(order.materials) && order.materials.length > 0 ? (
              // Bulk order: Show per-material quantity inputs
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">
                  Actual Quantities Delivered (Optional)
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Specify quantities for each material. Leave empty to use ordered quantities.
                </p>
                <div className="space-y-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {(order.materials || []).map((material, index) => {
                    const materialRequestId = material.materialRequestId?.toString() || material._id?.toString() || `material-${index}`
                    const currentQuantity = (confirmDeliveryData.materialQuantities && confirmDeliveryData.materialQuantities[materialRequestId]) || ""
                    const orderedQuantity = material.quantity || material.quantityNeeded || 0
                    const materialName = material.materialName || material.name || `Material ${index + 1}`
                    const unit = material.unit || order.unit || ""

                    return (
                      <div key={materialRequestId} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {materialName}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={currentQuantity}
                            onChange={(e) => {
                              setConfirmDeliveryData((prev) => ({
                                ...prev,
                                materialQuantities: {
                                  ...(prev.materialQuantities || {}),
                                  [materialRequestId]: e.target.value,
                                },
                              }))
                            }}
                            min="0.01"
                            step="0.01"
                            placeholder={orderedQuantity.toString()}
                            className="flex-1 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500"
                          />
                          <span className="text-sm text-gray-600 whitespace-nowrap">{unit}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Ordered: {orderedQuantity} {unit}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Or use the single quantity field below to apply the same quantity to all materials.
                </p>
              </div>
            ) : (
              // Single order: Show single quantity input
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Actual Quantity Delivered (Optional)
                </label>
                <input
                  type="number"
                  value={confirmDeliveryData.actualQuantityDelivered}
                  onChange={(e) =>
                    setConfirmDeliveryData((prev) => ({ ...prev, actualQuantityDelivered: e.target.value }))
                  }
                  min="0.01"
                  step="0.01"
                  placeholder={order.quantityOrdered?.toString() || ""}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Leave empty to use ordered quantity ({order.quantityOrdered || 0} {order.unit || ""})
                </p>
              </div>
            )}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Actual Unit Cost (Optional)
              </label>
              <input
                type="number"
                value={confirmDeliveryData.actualUnitCost}
                onChange={(e) => setConfirmDeliveryData((prev) => ({ ...prev, actualUnitCost: e.target.value }))}
                min="0"
                step="0.01"
                placeholder={order.unitCost?.toString() || ""}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Leave empty to use ordered unit cost (
                {order.unitCost
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "KES" }).format(order.unitCost)
                  : "N/A"}
                )
              </p>
            </div>
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Delivery Notes (Optional)
              </label>
              <textarea
                value={confirmDeliveryData.notes}
                onChange={(e) => setConfirmDeliveryData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500"
                placeholder="Add any notes about the delivery, condition of materials, discrepancies, etc..."
              />
              <p className="text-sm text-gray-600 mt-1">
                Document any important details about the delivery for audit purposes
              </p>
            </div>
          </div>
        </ConfirmationModal>

        {/* Retry Modal */}
        <ConfirmationModal
          isOpen={showRetryModal}
          onClose={() => {
            if (!isModifying) {
              setShowRetryModal(false)
              setRetryData({
                adjustments: {
                  unitCost: "",
                  quantityOrdered: "",
                  deliveryDate: "",
                  terms: "",
                  notes: "",
                },
                notes: "",
                communicationChannels: ["email"],
                sendImmediately: true,
              })
            }
          }}
          onConfirm={handleRetry}
          title="Retry with Same Supplier"
          message={`Retry this rejected order with ${order.supplierName}. Make adjustments to address the rejection reason.`}
          confirmText="Send Retry"
          cancelText="Cancel"
          confirmColor="blue"
          isLoading={isModifying}
        >
          <div className="mt-4 space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Original Rejection:</strong> {order.rejectionReason}{" "}
                {order.rejectionSubcategory && `- ${order.rejectionSubcategory}`}
              </p>
              {order.retryRecommendation && (
                <p className="text-sm text-yellow-700 mt-1">
                  <strong>Recommendation:</strong> {order.retryRecommendation}
                </p>
              )}
              <p className="text-xs text-yellow-600 mt-2">Retry attempt #{(order.retryCount || 0) + 1} of 3 maximum</p>
            </div>

            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2 leading-normal">Adjustments</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">New Unit Cost</label>
                  <input
                    type="number"
                    value={retryData.adjustments.unitCost}
                    onChange={(e) =>
                      setRetryData((prev) => ({
                        ...prev,
                        adjustments: { ...prev.adjustments, unitCost: e.target.value },
                      }))
                    }
                    min="0"
                    step="0.01"
                    placeholder={order.unitCost?.toString() || ""}
                    disabled={isModifying}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">New Quantity</label>
                  <input
                    type="number"
                    value={retryData.adjustments.quantityOrdered}
                    onChange={(e) =>
                      setRetryData((prev) => ({
                        ...prev,
                        adjustments: { ...prev.adjustments, quantityOrdered: e.target.value },
                      }))
                    }
                    min="0.01"
                    step="0.01"
                    placeholder={order.quantityOrdered?.toString() || ""}
                    disabled={isModifying}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">New Delivery Date</label>
                  <input
                    type="date"
                    value={retryData.adjustments.deliveryDate}
                    onChange={(e) =>
                      setRetryData((prev) => ({
                        ...prev,
                        adjustments: { ...prev.adjustments, deliveryDate: e.target.value },
                      }))
                    }
                    min={new Date().toISOString().split("T")[0]}
                    disabled={isModifying}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">New Terms</label>
                  <input
                    type="text"
                    value={retryData.adjustments.terms}
                    onChange={(e) =>
                      setRetryData((prev) => ({
                        ...prev,
                        adjustments: { ...prev.adjustments, terms: e.target.value },
                      }))
                    }
                    placeholder={order.terms || ""}
                    disabled={isModifying}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 disabled:opacity-50"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-600 mb-1">Additional Notes</label>
                <textarea
                  value={retryData.adjustments.notes}
                  onChange={(e) =>
                    setRetryData((prev) => ({
                      ...prev,
                      adjustments: { ...prev.adjustments, notes: e.target.value },
                    }))
                  }
                  rows={2}
                  disabled={isModifying}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                  placeholder="Explain the adjustments made..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Communication Channels</label>
              <div className="space-y-2">
                {["email", "sms", "push"].map((channel) => (
                  <label key={channel} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={retryData.communicationChannels.includes(channel)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRetryData((prev) => ({
                            ...prev,
                            communicationChannels: [...prev.communicationChannels, channel],
                          }))
                        } else {
                          setRetryData((prev) => ({
                            ...prev,
                            communicationChannels: prev.communicationChannels.filter((c) => c !== channel),
                          }))
                        }
                      }}
                      disabled={isModifying}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 capitalize">{channel}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={retryData.sendImmediately}
                  onChange={(e) =>
                    setRetryData((prev) => ({
                      ...prev,
                      sendImmediately: e.target.checked,
                    }))
                  }
                  disabled={isModifying}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Send retry immediately</span>
              </label>
            </div>
          </div>
        </ConfirmationModal>

        {/* Alternative Suppliers Modal */}
        <ConfirmationModal
          isOpen={showAlternativesModal}
          onClose={() => {
            if (!isModifying) {
              setShowAlternativesModal(false)
              setSelectedAlternativeSuppliers([])
              setAlternativeSuppliers([])
              setFilteredSuppliers([])
              setSimpleList([])
              setAlternativeSearchQuery("")
              setAlternativeMode("simple")
              setAlternativeDataQuality(0)
              setViewMode("recommended")
              setAlternativesData({
                adjustments: {
                  unitCost: "",
                  quantityOrdered: "",
                  deliveryDate: "",
                  terms: "",
                  notes: "",
                },
                notes: "",
                communicationChannels: ["email"],
                sendImmediately: true,
              })
            }
          }}
          onConfirm={handleSendAlternatives}
          title="Send to Alternative Suppliers"
          message={isBulkOrderAlternative 
            ? `Assign alternative suppliers for ${rejectedMaterials.length} rejected material${rejectedMaterials.length !== 1 ? 's' : ''}. You can assign different suppliers to different materials.`
            : `Find and send orders to alternative suppliers for ${order.materialName}. Select suppliers below and make any necessary adjustments.`}
          confirmText="Send Orders"
          cancelText="Cancel"
          confirmColor="purple"
          isLoading={isModifying}
          size={isBulkOrderAlternative ? "2xl" : "xl"}
          showIcon={false}
        >
          {/* Responsive Layout: Two columns on large screens, stacked on mobile */}
          <div className={`${isBulkOrderAlternative ? 'lg:grid lg:grid-cols-2 lg:gap-6' : ''} space-y-4 lg:space-y-0`}>
            {/* Left Column: Materials Assignment (Bulk Mode) or Main Content (Single Mode) */}
            <div className={`${isBulkOrderAlternative ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-4`}>
              {/* Mode Indicator Banner */}
              <div className={`p-3 sm:p-4 rounded-lg border-2 ${
                isBulkOrderAlternative 
                  ? 'bg-purple-50 border-purple-300' 
                  : 'bg-blue-50 border-blue-300'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-lg sm:text-xl ${
                    isBulkOrderAlternative ? 'text-purple-700' : 'text-blue-700'
                  }`}>
                    {isBulkOrderAlternative ? '📦' : '📄'}
                  </span>
                  <div className="flex-1">
                    <h4 className={`font-semibold text-sm sm:text-base ${
                      isBulkOrderAlternative ? 'text-purple-900' : 'text-blue-900'
                    }`}>
                      {isBulkOrderAlternative 
                        ? `Bulk Order Mode - ${rejectedMaterials.length} Rejected Material${rejectedMaterials.length !== 1 ? 's' : ''}`
                        : 'Single Material Order Mode'}
                    </h4>
                    <p className={`text-xs sm:text-sm mt-1 ${
                      isBulkOrderAlternative ? 'text-purple-700' : 'text-blue-700'
                    }`}>
                      {isBulkOrderAlternative
                        ? 'Assign different suppliers to each rejected material. You can split quantities across multiple suppliers per material.'
                        : 'Find and send this single material order to alternative suppliers. Select one or more suppliers below.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div>
              <form onSubmit={handleAlternativeSearch} className="flex gap-2">
                <input
                  type="text"
                  value={alternativeSearchQuery}
                  onChange={(e) => setAlternativeSearchQuery(e.target.value)}
                  placeholder="Search suppliers by name, email, or phone..."
                  className="flex-1 px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500"
                  disabled={loadingAlternatives}
                />
                <button
                  type="submit"
                  disabled={loadingAlternatives}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAlternatives ? "Searching..." : "Search"}
                </button>
              </form>

              {/* Mode and Data Quality Indicator */}
              <div className="mt-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Search Mode:</span>
                  <span
                    className={`px-2 py-1 rounded font-medium ${
                      alternativeMode === "simple"
                        ? "bg-blue-100 text-blue-700"
                        : alternativeMode === "hybrid"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                    }`}
                  >
                    {alternativeMode === "simple"
                      ? "Simple"
                      : alternativeMode === "hybrid"
                        ? "Hybrid"
                        : "Smart"}
                  </span>
                  {alternativeDataQuality > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="font-medium text-gray-700">Data Quality:</span>
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              alternativeDataQuality < 30
                                ? "bg-red-500"
                                : alternativeDataQuality < 70
                                  ? "bg-yellow-500"
                                  : "bg-green-500"
                            }`}
                            style={{ width: `${alternativeDataQuality}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-800">{alternativeDataQuality}%</span>
                      </div>
                    </>
                  )}
                </div>
                {alternativeSuppliers.length > 0 && (
                  <span className="font-medium text-gray-700">
                    {alternativeSuppliers.length} supplier{alternativeSuppliers.length !== 1 ? "s" : ""} found
                  </span>
                )}
              </div>
            </div>

            {/* Hybrid Mode Toggle */}
            {alternativeMode === "hybrid" && simpleList.length > 0 && alternativeSuppliers.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-yellow-800">View Mode:</span>
                  <div className="flex gap-1 bg-white rounded-lg p-1 border border-yellow-300">
                    <button
                      type="button"
                      onClick={() => setViewMode("recommended")}
                      className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                        viewMode === "recommended"
                          ? "bg-yellow-600 text-white shadow-sm"
                          : "text-yellow-700 hover:bg-yellow-50"
                      }`}
                    >
                      Recommended ({alternativeSuppliers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("all")}
                      className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                        viewMode === "all"
                          ? "bg-yellow-600 text-white shadow-sm"
                          : "text-yellow-700 hover:bg-yellow-50"
                      }`}
                    >
                      All Suppliers ({simpleList.length})
                    </button>
                  </div>
                </div>
                <span className="text-xs text-yellow-700">
                  {viewMode === "recommended"
                    ? "⭐ Algorithm-recommended suppliers"
                    : "📋 Complete supplier list"}
                </span>
              </div>
            )}

            {/* Bulk Order: Rejected Materials Assignment */}
            {isBulkOrderAlternative && rejectedMaterials.length > 0 && (
              <div className="border-2 border-purple-400 rounded-lg p-5 bg-gradient-to-br from-purple-50 to-purple-100 shadow-md">
                <div className="mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-purple-900 mb-2 flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">📦</span>
                    <span>Assign Suppliers to Rejected Materials ({rejectedMaterials.length})</span>
                  </h3>
                  <div className="bg-white border border-purple-200 rounded-lg p-3 mb-3">
                    <p className="text-sm font-semibold text-purple-800 mb-1">
                      ⚡ How to assign suppliers:
                    </p>
                    <ol className="text-xs sm:text-sm text-purple-700 list-decimal list-inside space-y-1 ml-2">
                      <li>Use the <strong>"Assign Supplier"</strong> dropdown below each material</li>
                      <li>Select a supplier from the dropdown (suppliers are listed in the reference section below)</li>
                      <li>You can assign multiple suppliers per material to split quantities</li>
                      <li>Adjust quantities and costs for each supplier assignment as needed</li>
                    </ol>
                  </div>
                </div>
                
                <div className="space-y-4 max-h-[50vh] lg:max-h-[60vh] overflow-y-auto pr-2">
                  {materialAssignments.map((assignment, materialIndex) => {
                    const material = rejectedMaterials.find(m => 
                      (m.materialRequestId || m._id) === assignment.materialRequestId
                    ) || assignment

                    return (
                      <div key={assignment.materialRequestId} className="bg-white border-2 border-purple-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-lg text-gray-900">{material.materialName || assignment.materialName}</h4>
                              <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                                assignment.suppliers.length > 0 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-yellow-500 text-white'
                              }`}>
                                {assignment.suppliers.length > 0 
                                  ? `✓ ${assignment.suppliers.length} supplier${assignment.suppliers.length !== 1 ? 's' : ''}`
                                  : '⚠ No suppliers'}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-700 mt-1">
                              <span>Quantity: {material.quantity || assignment.quantity} {material.unit || assignment.unit}</span>
                              <span className="mx-2">•</span>
                              <span>Unit Cost: Ksh {material.unitCost || assignment.unitCost}</span>
                              <span className="mx-2">•</span>
                              <span>Total: Ksh {material.totalCost || assignment.totalCost}</span>
                            </div>
                            {material.rejectionReason && (
                              <div className="text-xs text-red-600 mt-1">
                                Rejection: {material.rejectionReason}
                                {material.rejectionSubcategory && ` - ${material.rejectionSubcategory}`}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Assigned Suppliers */}
                        {assignment.suppliers.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {assignment.suppliers.map((supplierAssignment, supplierIndex) => {
                              const supplier = filteredSuppliers.find(s => 
                                (s.id || s._id) === supplierAssignment.supplierId
                              ) || alternativeSuppliers.find(s => 
                                (s.id || s._id) === supplierAssignment.supplierId
                              )

                              return (
                                <div key={`${assignment.materialRequestId}-${supplierAssignment.supplierId}`} 
                                     className="bg-gray-50 border border-gray-200 rounded p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {supplier?.name || 'Unknown Supplier'}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {supplier?.email || 'No email'}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeSupplierFromMaterial(assignment.materialRequestId, supplierAssignment.supplierId)}
                                      className="text-red-600 hover:text-red-800 text-sm"
                                      disabled={isModifying}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  
                                  {/* Quantity Split */}
                                  <div className="grid grid-cols-2 gap-2 mb-2">
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Quantity {assignment.suppliers.length > 1 ? '(split)' : ''}
                                      </label>
                                      <input
                                        type="number"
                                        value={supplierAssignment.quantity || ''}
                                        onChange={(e) => updateMaterialSupplierQuantity(
                                          assignment.materialRequestId,
                                          supplierAssignment.supplierId,
                                          e.target.value
                                        )}
                                        min="0.01"
                                        step="0.01"
                                        max={assignment.quantity}
                                        placeholder={assignment.quantity.toString()}
                                        disabled={isModifying}
                                        className="w-full px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                      />
                                      <div className="text-xs font-medium text-gray-600 mt-0.5">
                                        Max: {assignment.quantity} {assignment.unit}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Unit Cost
                                      </label>
                                      <input
                                        type="number"
                                        value={supplierAssignment.adjustments?.unitCost || ''}
                                        onChange={(e) => updateMaterialSupplierAdjustment(
                                          assignment.materialRequestId,
                                          supplierAssignment.supplierId,
                                          'unitCost',
                                          e.target.value
                                        )}
                                        min="0"
                                        step="0.01"
                                        placeholder={assignment.unitCost.toString()}
                                        disabled={isModifying}
                                        className="w-full px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Delivery Date */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      Delivery Date
                                    </label>
                                    <input
                                      type="date"
                                      value={supplierAssignment.adjustments?.deliveryDate || ''}
                                      onChange={(e) => updateMaterialSupplierAdjustment(
                                        assignment.materialRequestId,
                                        supplierAssignment.supplierId,
                                        'deliveryDate',
                                        e.target.value
                                      )}
                                      min={new Date().toISOString().split('T')[0]}
                                      disabled={isModifying}
                                      className="w-full px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Add Supplier Button */}
                        <div className="mt-4 pt-4 border-t-2 border-purple-200">
                          <label className="block text-sm font-bold text-purple-900 mb-2 flex items-center gap-2">
                            <span>➕</span>
                            <span>Assign Supplier to This Material</span>
                          </label>
                          <p className="text-xs text-gray-600 mb-2">
                            Select a supplier from the dropdown below. Available suppliers are shown in the reference list.
                          </p>
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                addSupplierToMaterial(assignment.materialRequestId, e.target.value)
                                e.target.value = ""
                              }
                            }}
                            disabled={isModifying || filteredSuppliers.length === 0}
                            className="w-full px-4 py-3 text-gray-900 bg-white border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 font-medium"
                          >
                            <option value="">Select a supplier from the list below...</option>
                            {filteredSuppliers
                              .filter(s => !assignment.suppliers.some(sa => sa.supplierId === (s.id || s._id)))
                              .map(supplier => (
                                <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                                  {supplier.name} {supplier.email ? `(${supplier.email})` : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            </div>
            {/* End of Left Column */}

            {/* Right Column: Supplier List (Bulk Mode) or Full Width (Single Mode) */}
            <div className={`${isBulkOrderAlternative ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-4`}>
              {loadingAlternatives ? (
                <div className="text-center py-8">
                  <LoadingSpinner size="md" color="purple-600" />
                  <p className="mt-2 font-medium text-gray-700">Loading suppliers...</p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="font-medium text-gray-700">
                    {alternativeSearchQuery
                      ? `No suppliers found matching "${alternativeSearchQuery}"`
                      : isBulkOrderAlternative
                        ? "No alternative suppliers found for bulk order"
                        : "No alternative suppliers found for single order"}
                  </p>
                  {alternativeSearchQuery && (
                    <button
                      onClick={() => {
                        setAlternativeSearchQuery("")
                        handleFetchAlternatives("")
                      }}
                      className="mt-2 text-sm text-purple-600 hover:text-purple-800"
                    >
                      Clear search and show all
                    </button>
                  )}
                  {alternativeSuppliers.length > 0 && alternativeSearchQuery && (
                    <p className="mt-2 text-xs font-medium text-gray-600">
                      Showing filtered results. {alternativeSuppliers.length} total
                      supplier{alternativeSuppliers.length !== 1 ? "s" : ""} available.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <label className="block text-base font-bold text-gray-900 leading-normal">
                        {isBulkOrderAlternative 
                          ? "📋 Available Suppliers (Reference List)"
                          : "📄 Select Alternative Suppliers for Single Order"}
                        <span className="ml-2 text-sm font-medium text-gray-600">
                          ({filteredSuppliers.length} {alternativeSearchQuery ? "filtered" : "available"}
                          {alternativeMode === "hybrid" &&
                            viewMode === "all" &&
                            simpleList.length !== filteredSuppliers.length
                            ? ` of ${simpleList.length}`
                            : alternativeSuppliers.length !== filteredSuppliers.length
                              ? ` of ${alternativeSuppliers.length}`
                              : ""}
                          )
                        </span>
                      </label>
                      {!isBulkOrderAlternative && selectedAlternativeSuppliers.length > 0 && (
                        <span className="text-sm text-purple-700 font-bold">
                          ✓ {selectedAlternativeSuppliers.length} selected
                        </span>
                      )}
                    </div>
                    {isBulkOrderAlternative && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-800">
                          💡 <strong>Note:</strong> This is a reference list showing available suppliers. 
                          To assign suppliers, use the "Assign Supplier" dropdowns in each material card above.
                        </p>
                      </div>
                    )}
                  {alternativeSearchQuery &&
                    filteredSuppliers.length <
                      (alternativeMode === "hybrid" && viewMode === "all"
                        ? simpleList.length
                        : alternativeSuppliers.length) && (
                      <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-800">
                        Showing {filteredSuppliers.length} of{" "}
                        {alternativeMode === "hybrid" && viewMode === "all"
                          ? simpleList.length
                          : alternativeSuppliers.length}{" "}
                        suppliers matching "{alternativeSearchQuery}"
                      </div>
                    )}
                  {alternativeMode === "hybrid" &&
                    viewMode === "recommended" &&
                    alternativeSuppliers.length > 0 && (
                      <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs font-medium text-green-800">
                        ⭐ Showing {alternativeSuppliers.length} algorithm-recommended
                        supplier{alternativeSuppliers.length !== 1 ? "s" : ""} based on data quality
                      </div>
                    )}
                  <div className={`space-y-3 ${
                    isBulkOrderAlternative 
                      ? 'max-h-[60vh] lg:max-h-[70vh]' 
                      : 'max-h-64'
                  } overflow-y-auto border border-gray-200 rounded-lg p-3 ${
                    isBulkOrderAlternative ? 'bg-gray-50' : ''
                  }`}>
                    {filteredSuppliers.map((supplier) => {
                      const supplierId = supplier.id || supplier._id
                      // Check if supplier is in recommended list (for highlighting)
                      const isRecommended =
                        alternativeMode === "hybrid" &&
                        viewMode === "all" &&
                        alternativeSuppliers.some(
                          (rec) => rec.id === supplierId || rec._id === supplierId,
                        )
                      
                      // In bulk mode, check which materials this supplier is assigned to
                      const assignedMaterials = isBulkOrderAlternative
                        ? materialAssignments
                            .filter(ma => ma.suppliers.some(s => s.supplierId === supplierId))
                            .map(ma => {
                              const material = rejectedMaterials.find(m => 
                                (m.materialRequestId || m._id) === ma.materialRequestId
                              ) || ma
                              return material.materialName || 'Unknown Material'
                            })
                        : []

                      return (
                        <div
                          key={supplierId}
                          className={`border rounded-lg p-3 transition-all ${
                            isRecommended ? "border-yellow-400 bg-yellow-50 shadow-sm" : 
                            isBulkOrderAlternative && assignedMaterials.length > 0
                              ? "border-green-400 bg-green-50 shadow-sm"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {isBulkOrderAlternative && assignedMaterials.length > 0 && (
                                  <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded">
                                    ✓ Assigned ({assignedMaterials.length} material{assignedMaterials.length !== 1 ? 's' : ''})
                                  </span>
                                )}
                                {isRecommended && (
                                  <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs font-medium rounded">
                                    ⭐ Recommended
                                  </span>
                                )}
                                {alternativeMode !== "simple" &&
                                  supplier.priority !== undefined &&
                                  supplier.priority > 0 && (
                                    <span
                                      className={`px-2 py-0.5 text-xs font-medium rounded ${
                                        supplier.priority >= 80
                                          ? "bg-green-100 text-green-700"
                                          : supplier.priority >= 60
                                            ? "bg-yellow-100 text-yellow-700"
                                            : "bg-gray-100 text-gray-700"
                                      }`}
                                    >
                                      Score: {supplier.priority}
                                    </span>
                                  )}
                              </div>
                              {isBulkOrderAlternative ? (
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-gray-900">{supplier.name}</h4>
                                  </div>
                                  {assignedMaterials.length > 0 && (
                                    <div className="mt-2 p-2 bg-white border border-green-300 rounded text-xs">
                                      <div className="font-semibold text-green-800 mb-1">Assigned to:</div>
                                      <ul className="list-disc list-inside text-green-700 space-y-0.5">
                                        {assignedMaterials.map((materialName, idx) => (
                                          <li key={idx}>{materialName}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {/* Contact Information for bulk mode */}
                                  <div className="mt-2 space-y-1 text-sm">
                                    <div className="flex items-center text-gray-700">
                                      <span className="mr-2">📧</span>
                                      <span>{supplier.email}</span>
                                    </div>
                                    <div className="flex items-center text-gray-700">
                                      <span className="mr-2">📱</span>
                                      <span>{supplier.phone}</span>
                                    </div>
                                    {supplier.contactPerson && (
                                      <div className="flex items-center text-gray-600 text-xs">
                                        <span className="mr-2">👤</span>
                                        <span>Contact: {supplier.contactPerson}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <label className="flex items-start cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedAlternativeSuppliers.includes(supplierId)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedAlternativeSuppliers((prev) => [...prev, supplierId])
                                      } else {
                                        setSelectedAlternativeSuppliers((prev) =>
                                          prev.filter((id) => id !== supplierId),
                                        )
                                      }
                                    }}
                                    disabled={isModifying}
                                    className="mr-3 mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold text-gray-900">{supplier.name}</h4>
                                    </div>

                                    {/* Show recommendation reasons only in hybrid/smart mode */}
                                    {alternativeMode !== "simple" &&
                                      supplier.recommendationReasons &&
                                      supplier.recommendationReasons.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                          {supplier.recommendationReasons.slice(0, 3).map((reason, index) => (
                                            <div key={index} className="flex items-center text-xs text-gray-600">
                                              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                              {typeof reason === "string" ? reason : reason.text || reason}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                    {/* Confidence indicator for hybrid/smart mode */}
                                    {alternativeMode !== "simple" &&
                                      supplier.priority !== undefined && (
                                        <div className="mt-2">
                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="text-gray-600">Confidence:</span>
                                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full transition-all ${
                                                  supplier.priority >= 80
                                                    ? "bg-green-500"
                                                    : supplier.priority >= 60
                                                      ? "bg-yellow-500"
                                                      : "bg-orange-500"
                                                }`}
                                                style={{ width: `${supplier.priority}%` }}
                                              />
                                            </div>
                                            <span className="text-gray-600 font-medium">{supplier.priority}%</span>
                                          </div>
                                        </div>
                                      )}

                                    {/* Contact Information */}
                                    <div className="mt-2 space-y-1 text-sm">
                                      <div className="flex items-center text-gray-700">
                                        <span className="mr-2">📧</span>
                                        <span>{supplier.email}</span>
                                      </div>
                                      <div className="flex items-center text-gray-700">
                                        <span className="mr-2">📱</span>
                                        <span>{supplier.phone}</span>
                                      </div>
                                      {supplier.contactPerson && (
                                        <div className="flex items-center text-gray-600 text-xs">
                                          <span className="mr-2">👤</span>
                                          <span>Contact: {supplier.contactPerson}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Show estimated price/delivery only in hybrid/smart mode */}
                                    {alternativeMode !== "simple" &&
                                      supplier.estimatedPrice &&
                                      supplier.estimatedPrice.unitCost && (
                                        <div className="mt-2 text-sm text-gray-600">
                                          <span className="font-medium">Est. Price:</span>{" "}
                                          {supplier.estimatedPrice.unitCost.toLocaleString()} KES/unit
                                          {supplier.estimatedPrice.totalCost && (
                                            <span className="ml-2">
                                              ({supplier.estimatedPrice.totalCost.toLocaleString()} KES total)
                                            </span>
                                          )}
                                        </div>
                                      )}

                                    {alternativeMode !== "simple" &&
                                      supplier.estimatedDelivery &&
                                      supplier.estimatedDelivery.estimatedDays && (
                                        <div className="mt-1 text-sm text-gray-600">
                                          <span className="font-medium">Est. Delivery:</span>{" "}
                                          {supplier.estimatedDelivery.estimatedDays} days
                                        </div>
                                      )}

                                    {/* Communication Channels */}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {supplier.communicationChannels?.email && (
                                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">
                                          Email
                                        </span>
                                      )}
                                      {supplier.communicationChannels?.sms && (
                                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                                          SMS
                                        </span>
                                      )}
                                      {supplier.communicationChannels?.push && (
                                        <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded">
                                          Push
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                </>
              )}
            </div>
            {/* End of Right Column / Full Width Section */}

            {/* Adjustments Section - Only show for singular mode */}
            {!isBulkOrderAlternative && alternativeSuppliers.length > 0 && (
              <div className="lg:col-span-2">
                    <div>
                      <label className="block text-base font-bold text-gray-900 mb-2 leading-normal">
                        📝 Adjustments for Single Order
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">New Unit Cost</label>
                          <input
                            type="number"
                            value={alternativesData.adjustments.unitCost}
                            onChange={(e) =>
                              setAlternativesData((prev) => ({
                                ...prev,
                                adjustments: { ...prev.adjustments, unitCost: e.target.value },
                              }))
                            }
                            min="0"
                            step="0.01"
                            placeholder={order.unitCost?.toString() || ""}
                            disabled={isModifying}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">New Quantity</label>
                          <input
                            type="number"
                            value={alternativesData.adjustments.quantityOrdered}
                            onChange={(e) =>
                              setAlternativesData((prev) => ({
                                ...prev,
                                adjustments: { ...prev.adjustments, quantityOrdered: e.target.value },
                              }))
                            }
                            min="0.01"
                            step="0.01"
                            placeholder={order.quantityOrdered?.toString() || ""}
                            disabled={isModifying}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">New Delivery Date</label>
                          <input
                            type="date"
                            value={alternativesData.adjustments.deliveryDate}
                            onChange={(e) =>
                              setAlternativesData((prev) => ({
                                ...prev,
                                adjustments: { ...prev.adjustments, deliveryDate: e.target.value },
                              }))
                            }
                            min={new Date().toISOString().split("T")[0]}
                            disabled={isModifying}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 disabled:opacity-50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">New Terms</label>
                          <input
                            type="text"
                            value={alternativesData.adjustments.terms}
                            onChange={(e) =>
                              setAlternativesData((prev) => ({
                                ...prev,
                                adjustments: { ...prev.adjustments, terms: e.target.value },
                              }))
                            }
                            placeholder={order.terms || ""}
                            disabled={isModifying}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 disabled:opacity-50"
                          />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Additional Notes</label>
                        <textarea
                          value={alternativesData.adjustments.notes}
                          onChange={(e) =>
                            setAlternativesData((prev) => ({
                              ...prev,
                              adjustments: { ...prev.adjustments, notes: e.target.value },
                            }))
                          }
                          rows={2}
                          disabled={isModifying}
                          className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500"
                          placeholder="Explain the adjustments made for alternative suppliers..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Communication Channels</label>
                      <div className="space-y-2">
                        {["email", "sms", "push"].map((channel) => (
                          <label key={channel} className="flex items-center">
                            <input
                              type="checkbox"
                              checked={alternativesData.communicationChannels.includes(channel)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAlternativesData((prev) => ({
                                    ...prev,
                                    communicationChannels: [...prev.communicationChannels, channel],
                                  }))
                                } else {
                                  setAlternativesData((prev) => ({
                                    ...prev,
                                    communicationChannels: prev.communicationChannels.filter((c) => c !== channel),
                                  }))
                                }
                              }}
                              disabled={isModifying}
                              className="mr-2"
                            />
                            <span className="text-sm font-medium text-gray-800 capitalize">{channel}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={alternativesData.sendImmediately}
                          onChange={(e) =>
                            setAlternativesData((prev) => ({
                              ...prev,
                              sendImmediately: e.target.checked,
                            }))
                          }
                          disabled={isModifying}
                          className="mr-2"
                        />
                        <span className="text-sm font-medium text-gray-800">Send orders immediately</span>
                      </label>
                    </div>
              </div>
            )}
          </div>
          {/* End of Responsive Layout Grid */}
        </ConfirmationModal>

        {/* Approve Modification Modal */}
        <ConfirmationModal
          isOpen={showApproveModificationModal}
          onClose={() => {
            if (!isApprovingModification) {
              setShowApproveModificationModal(false)
              setModificationApprovalData({ approvalNotes: "", autoCommit: false })
            }
          }}
          onConfirm={handleApproveModification}
          title="Approve Modifications"
          message="Approve the supplier's proposed modifications to this purchase order."
          confirmText="Approve Modifications"
          cancelText="Cancel"
          confirmColor="green"
          isLoading={isApprovingModification}
        >
          <div className="mt-4 space-y-4">
            {order?.supplierModifications && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-600">New Quantity:</span>
                    <span className="ml-2 font-medium">
                      {order.supplierModifications.quantityOrdered || order.quantityOrdered} {order.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">New Unit Cost:</span>
                    <span className="ml-2 font-medium">
                      {formatCurrency(
                        order.supplierModifications.unitCost !== undefined
                          ? order.supplierModifications.unitCost
                          : order.unitCost,
                      )}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">New Total Cost:</span>
                    <span className="ml-2 font-medium">
                      {formatCurrency(
                        (order.supplierModifications.quantityOrdered || order.quantityOrdered) *
                          (order.supplierModifications.unitCost !== undefined
                            ? order.supplierModifications.unitCost
                            : order.unitCost),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Approval Notes (Optional)
              </label>
              <textarea
                value={modificationApprovalData.approvalNotes}
                onChange={(e) => setModificationApprovalData((prev) => ({ ...prev, approvalNotes: e.target.value }))}
                rows={3}
                disabled={isApprovingModification}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500"
                placeholder="Add any notes about this approval..."
              />
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={modificationApprovalData.autoCommit}
                  onChange={(e) =>
                    setModificationApprovalData((prev) => ({
                      ...prev,
                      autoCommit: e.target.checked,
                    }))
                  }
                  disabled={isApprovingModification}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Auto-commit order (accept modifications and commit financially)
                </span>
              </label>
            </div>
          </div>
        </ConfirmationModal>

        {/* Reject Modification Modal */}
        <ConfirmationModal
          isOpen={showRejectModificationModal}
          onClose={() => {
            if (!isRejectingModification) {
              setShowRejectModificationModal(false)
              setModificationRejectionData({ rejectionReason: "", revertToOriginal: true })
            }
          }}
          onConfirm={handleRejectModification}
          title="Reject Modifications"
          message="Reject the supplier's proposed modifications. You can choose to revert to original values or keep current values."
          confirmText="Reject Modifications"
          cancelText="Cancel"
          confirmColor="red"
          isLoading={isRejectingModification}
        >
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                Rejection Reason *
              </label>
              <textarea
                value={modificationRejectionData.rejectionReason}
                onChange={(e) =>
                  setModificationRejectionData((prev) => ({
                    ...prev,
                    rejectionReason: e.target.value,
                  }))
                }
                rows={3}
                required
                disabled={isRejectingModification}
                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 placeholder:text-gray-500"
                placeholder="Explain why you are rejecting these modifications..."
              />
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={modificationRejectionData.revertToOriginal}
                  onChange={(e) =>
                    setModificationRejectionData((prev) => ({
                      ...prev,
                      revertToOriginal: e.target.checked,
                    }))
                  }
                  disabled={isRejectingModification}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Revert to original order values</span>
              </label>
            </div>
          </div>
        </ConfirmationModal>
      </div>
    </AppLayout>
  )
}

export default function PurchaseOrderDetailPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <LoadingCard />
          </div>
        </AppLayout>
      }
    >
      <PurchaseOrderDetailPageContent />
    </Suspense>
  )
}