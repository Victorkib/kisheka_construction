/**
 * Add Material/Item Page
 * Multi-step form for creating new material entries
 * 
 * Route: /items/new
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { CloudinaryUploadWidget } from '@/components/uploads/cloudinary-upload-widget';
import { LoadingSpinner, LoadingOverlay, LoadingButton } from '@/components/loading';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/components/toast/toast-container';
import { MaterialLibraryPicker } from '@/components/material-library/material-library-picker';

function NewItemPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canAccess } = usePermissions();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [entryType, setEntryType] = useState(null); // null = not selected, 'new_purchase' or 'retroactive_entry'
  const [showContinueAnyway, setShowContinueAnyway] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [changingStep, setChangingStep] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [floors, setFloors] = useState([]);
  const [phases, setPhases] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingPhases, setLoadingPhases] = useState(false);

  // Predefined unit options
  const unitOptions = [
    'piece',
    'bag',
    'kg',
    'ton',
    'liter',
    'gallon',
    'meter',
    'square meter',
    'cubic meter',
    'roll',
    'sheet',
    'box',
    'carton',
    'pack',
    'set',
    'pair',
    'dozen',
    'others'
  ];

  const [formData, setFormData] = useState({
    projectId: '',
    name: '',
    description: '',
    category: '',
    categoryId: '',
    floor: '',
    phaseId: '',
    quantity: '',
    unit: 'piece',
    customUnit: '',
    unitCost: '',
    estimatedUnitCost: '',
    libraryMaterialId: '',
    supplierName: '',
    paymentMethod: 'CASH',
    invoiceNumber: '',
    invoiceDate: '',
    datePurchased: new Date().toISOString().split('T')[0],
    notes: '',
    // File uploads
    receiptFileUrl: null,
    invoiceFileUrl: null,
    deliveryNoteFileUrl: null,
    // Retroactive entry fields
    retroactiveNotes: '',
    originalPurchaseDate: '',
    documentationStatus: 'missing',
    costStatus: 'missing',
    // Finishing details (conditional based on category)
    finishingDetails: {
      brand: '',
      colour: '',
      technicianName: '',
      installationTeam: '',
      materialType: '',
      teamLeader: '',
      tileType: '',
      squareMeters: '',
      contractNumber: '',
      paymentSchedule: '',
      installationDate: '',
      warrantyDocuments: [],
    },
  });

  // Fetch user and set default entry type based on role
  useEffect(() => {
    fetchUser();
  }, []);

  // Fetch categories and projects on mount
  useEffect(() => {
    fetchCategories();
    fetchProjects();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        // Set default entry type based on role
        const role = data.data.role?.toLowerCase();
        if (role === 'clerk' || role === 'supervisor' || role === 'site_clerk') {
          // CLERK/SUPERVISOR should use new purchase workflow
          setEntryType('new_purchase');
        } else {
          // PM/OWNER can choose, default to null (show selector)
          setEntryType(null);
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  // Handle projectId from URL query parameter (runs once on mount)
  useEffect(() => {
    const projectIdFromUrl = searchParams.get('projectId');
    if (projectIdFromUrl) {
      setFormData(prev => {
        // Only set if not already set to avoid overwriting user selection
        if (!prev.projectId) {
          return { ...prev, projectId: projectIdFromUrl };
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch floors and phases when projectId changes
  useEffect(() => {
    if (formData.projectId) {
      fetchFloors(formData.projectId);
      fetchPhases(formData.projectId);
    } else {
      setFloors([]);
      setPhases([]);
      // Clear floor and phase selection when project is cleared
      setFormData(prev => ({ ...prev, floor: '', phaseId: '' }));
    }
  }, [formData.projectId]);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data || []);
      } else {
        setCategories([]);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchFloors = async (projectId) => {
    if (!projectId) {
      setFloors([]);
      return;
    }
    setLoadingFloors(true);
    try {
      const response = await fetch(`/api/floors?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setFloors(data.data || []);
        // Clear floor selection if current floor is not in the new list
        setFormData(prev => {
          const currentFloorId = prev.floor;
          const floorExists = data.data.some(f => f._id === currentFloorId);
          return {
            ...prev,
            floor: floorExists ? currentFloorId : ''
          };
        });
      } else {
        setFloors([]);
      }
    } catch (err) {
      console.error('Error fetching floors:', err);
      setFloors([]);
    } finally {
      setLoadingFloors(false);
    }
  };

  const fetchPhases = async (projectId) => {
    if (!projectId) {
      setPhases([]);
      return;
    }
    setLoadingPhases(true);
    try {
      const response = await fetch(`/api/phases?projectId=${projectId}`);
      const data = await response.json();
      if (data.success) {
        setPhases(data.data || []);
        // Clear phase selection if current phase is not in the new list
        setFormData(prev => {
          const currentPhaseId = prev.phaseId;
          const phaseExists = data.data.some(p => p._id === currentPhaseId);
          return {
            ...prev,
            phaseId: phaseExists ? currentPhaseId : ''
          };
        });
      } else {
        setPhases([]);
      }
    } catch (err) {
      console.error('Error fetching phases:', err);
      setPhases([]);
    } finally {
      setLoadingPhases(false);
    }
  };

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      if (data.success) {
        setProjects(data.data || []);
        // Auto-select first project if only one exists
        if (data.data && data.data.length === 1 && !formData.projectId) {
          setFormData(prev => ({ ...prev, projectId: data.data[0]._id }));
        }
      } else {
        setProjects([]);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Clear floor selection when project changes
      if (name === 'projectId') {
        updated.floor = '';
      }
      // Handle unit selection - clear custom unit if not "others"
      if (name === 'unit') {
        if (value !== 'others') {
          updated.customUnit = '';
        }
      }
      return updated;
    });
  };

  const calculateTotal = () => {
    const qty = parseFloat(formData.quantity) || 0;
    const cost = parseFloat(formData.unitCost || formData.estimatedUnitCost) || 0;
    return (qty * cost).toFixed(2);
  };

  const handleLibrarySelect = (material) => {
    setFormData((prev) => ({
      ...prev,
      name: material.name || prev.name,
      description: material.description || prev.description,
      unit: material.defaultUnit || prev.unit || 'piece',
      categoryId: material.categoryId?.toString() || prev.categoryId,
      category: material.category || prev.category,
      estimatedUnitCost: prev.unitCost ? prev.estimatedUnitCost : (material.defaultUnitCost || prev.estimatedUnitCost),
      libraryMaterialId: material._id?.toString() || prev.libraryMaterialId,
    }));
  };

  // Helper function to check if category is a finishing category
  const isFinishingCategory = (categoryName) => {
    if (!categoryName) return false;
    const finishingCategories = [
      'electrical works',
      'plumbing works',
      'joinery',
      'carpentry',
      'paintwork',
      'tiling',
      'terrazzo',
      'lift installation',
    ];
    return finishingCategories.some(fc => 
      categoryName.toLowerCase().includes(fc.toLowerCase())
    );
  };

  // Helper function to get finishing category type
  const getFinishingCategoryType = (categoryName) => {
    if (!categoryName) return null;
    const name = categoryName.toLowerCase();
    if (name.includes('electrical')) return 'electrical';
    if (name.includes('plumbing')) return 'plumbing';
    if (name.includes('joinery') || name.includes('carpentry')) return 'joinery';
    if (name.includes('paintwork') || name.includes('paint')) return 'paintwork';
    if (name.includes('tiling') || name.includes('terrazzo')) return 'tiling';
    if (name.includes('lift')) return 'lift';
    return null;
  };

  // Handle finishing details changes
  const handleFinishingChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      finishingDetails: {
        ...prev.finishingDetails,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (!formData.projectId) {
      setError('Please select a project');
      setLoading(false);
      return;
    }

    if (!formData.name || formData.name.trim().length === 0) {
      setError('Material name is required');
      setLoading(false);
      return;
    }

    if (!formData.phaseId) {
      setError('Please select a construction phase');
      setLoading(false);
      return;
    }

    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      setError('Please enter a valid quantity');
      setLoading(false);
      return;
    }

    // Validation based on entry type
    if (entryType === 'retroactive_entry') {
      // For retroactive entries, unitCost and supplierName are optional
      // But if unitCost is provided, it must be valid
      if (formData.unitCost && parseFloat(formData.unitCost) <= 0) {
        setError('If provided, unit cost must be greater than 0');
        setLoading(false);
        return;
      }
      if (formData.estimatedUnitCost && parseFloat(formData.estimatedUnitCost) <= 0) {
        setError('If provided, estimated unit cost must be greater than 0');
        setLoading(false);
        return;
      }
    } else {
      // For new procurement (shouldn't happen, but safety check)
      if (!formData.unitCost || parseFloat(formData.unitCost) <= 0) {
        setError('Please enter a valid unit cost');
        setLoading(false);
        return;
      }
      if (!formData.supplierName || formData.supplierName.trim().length === 0) {
        setError('Supplier name is required');
        setLoading(false);
        return;
      }
    }

    try {
      // Prepare finishingDetails if category is a finishing category
      // Get category name - prefer formData.category, fallback to lookup by categoryId
      let categoryName = formData.category;
      if (!categoryName && formData.categoryId) {
        const foundCategory = categories.find(c => c._id === formData.categoryId);
        categoryName = foundCategory?.name || '';
      }
      
      let finishingDetails = null;
      
      if (isFinishingCategory(categoryName)) {
        // Only include finishingDetails if it has meaningful data
        const hasData = Object.values(formData.finishingDetails).some(val => 
          val !== null && val !== undefined && val !== '' && 
          (Array.isArray(val) ? val.length > 0 : true)
        );
        if (hasData) {
          finishingDetails = formData.finishingDetails;
        }
      }

      // Prepare payload with entry type
      const payload = {
        ...formData,
        quantityPurchased: formData.quantity,
        unit: formData.unit === 'others' ? formData.customUnit.trim() : formData.unit.trim(),
        category: categoryName,
        categoryId: formData.categoryId || null,
        entryType: 'retroactive_entry', // Direct creation is always retroactive
        isRetroactiveEntry: entryType === 'retroactive_entry',
        ...(formData.libraryMaterialId && { libraryMaterialId: formData.libraryMaterialId }),
        ...(formData.estimatedUnitCost && { estimatedUnitCost: parseFloat(formData.estimatedUnitCost) }),
        ...(finishingDetails && { finishingDetails }),
        // Retroactive entry fields
        ...(entryType === 'retroactive_entry' && {
          retroactiveNotes: formData.retroactiveNotes || '',
          originalPurchaseDate: formData.originalPurchaseDate || formData.datePurchased,
          documentationStatus: formData.documentationStatus || 'missing',
          costStatus: formData.costStatus || (formData.unitCost ? 'actual' : 'missing'),
        }),
      };

      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create material');
      }

      // Show capital warning if present
      if (data.data.capitalWarning) {
        toast.showWarning(
          `Material created but capital insufficient: ${data.data.capitalWarning.message}`,
          { duration: 10000 }
        );
      } else {
        toast.showSuccess('Material created successfully!');
      }

      // Redirect to material detail page
      router.push(`/items/${data.data._id}`);
    } catch (err) {
      setError(err.message);
      console.error('Create material error:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateStep = (stepNumber) => {
    switch (stepNumber) {
      case 1:
        if (!formData.projectId) {
          setError('Please select a project');
          return false;
        }
        if (!formData.name || formData.name.trim().length === 0) {
          setError('Material name is required');
          return false;
        }
        if (!formData.phaseId) {
          setError('Please select a construction phase');
          return false;
        }
        return true;
      case 2:
        if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
          setError('Please enter a valid quantity');
          return false;
        }
        if (!formData.unit) {
          setError('Please select a unit');
          return false;
        }
        // Validate unit - if "others" is selected, customUnit must be provided
        if (formData.unit === 'others' && (!formData.customUnit || formData.customUnit.trim().length === 0)) {
          setError('Please enter a custom unit name');
          return false;
        }
        return true;
      case 3:
        // For retroactive entries, unitCost and supplierName are optional
        if (entryType === 'retroactive_entry') {
          if (formData.unitCost && parseFloat(formData.unitCost) <= 0) {
            setError('If provided, unit cost must be greater than 0');
            return false;
          }
          if (formData.estimatedUnitCost && parseFloat(formData.estimatedUnitCost) <= 0) {
            setError('If provided, estimated unit cost must be greater than 0');
            return false;
          }
        } else {
          if (!formData.unitCost || parseFloat(formData.unitCost) <= 0) {
            setError('Please enter a valid unit cost');
            return false;
          }
          if (!formData.supplierName || formData.supplierName.trim().length === 0) {
            setError('Supplier name is required');
            return false;
          }
        }
        return true;
      case 4:
        // Step 4 (documents) is optional, so always valid
        return true;
      case 5:
        // Step 5 (review) validation is handled in handleSubmit
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (step < 5) {
      if (validateStep(step)) {
        setError(null);
        setChangingStep(true);
        // Small delay for smooth transition
        setTimeout(() => {
          setStep(step + 1);
          setChangingStep(false);
        }, 150);
      }
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <LoadingOverlay isLoading={loading} message="Creating material entry..." fullScreen={false} />
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/items"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Materials
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">Add New Material</h1>
          <p className="text-gray-600 mt-2">Create a new material entry</p>
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800 font-semibold mb-1">💡 When to use Materials vs Expenses:</p>
            <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
              <li><strong>Use Materials</strong> for physical items you purchase with quantities (e.g., cement, steel bars, tiles, paint, electrical wires, plumbing pipes)</li>
              <li><strong>Use Expenses</strong> for services, work performed, rentals, and operational costs (e.g., excavation, equipment rental, transport, utilities)</li>
              <li>Materials are deducted from your <strong>Materials Budget</strong></li>
            </ul>
          </div>
        </div>

        {/* Entry Type Selection */}
        {entryType === null && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Entry Type</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 border-2 border-blue-200 rounded-lg hover:border-blue-400 cursor-pointer transition"
                onClick={() => setEntryType('new_purchase')}>
                <input
                  type="radio"
                  name="entryType"
                  value="new_purchase"
                  checked={entryType === 'new_purchase'}
                  onChange={() => setEntryType('new_purchase')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label className="font-semibold text-gray-900 cursor-pointer">New Purchase (Recommended)</label>
                  <p className="text-sm text-gray-600 mt-1">For materials that need to be purchased. This will create a Material Request that goes through the approval and purchase order workflow.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-gray-400 cursor-pointer transition"
                onClick={() => setEntryType('retroactive_entry')}>
                <input
                  type="radio"
                  name="entryType"
                  value="retroactive_entry"
                  checked={entryType === 'retroactive_entry'}
                  onChange={() => setEntryType('retroactive_entry')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label className="font-semibold text-gray-900 cursor-pointer">Retroactive Entry</label>
                  <p className="text-sm text-gray-600 mt-1">For materials already purchased or on-site. Documentation is optional. Use this for historical entries or materials with lost receipts.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Purchase Selection - Redirect Message */}
        {entryType === 'new_purchase' && !showContinueAnyway && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">📋 New Purchase Workflow</h2>
            <p className="text-sm text-blue-800 mb-4">
              For new purchases, please create a Material Request first. This ensures proper approval and purchase order workflow.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                Project (optional)
              </label>
              {projects.length > 0 ? (
                <select
                  name="projectId"
                  value={formData.projectId}
                  onChange={handleChange}
                  disabled={loadingProjects || loading}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingProjects ? (
                    <option>Loading projects...</option>
                  ) : (
                    <>
                      <option value="">Select a project</option>
                      {projects.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.projectName || project.projectCode} {project.location ? `- ${project.location}` : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              ) : (
                <p className="text-xs text-blue-800">No projects available yet.</p>
              )}
            </div>
            <div className="flex gap-3">
              <Link
                href={`/material-requests/new${formData.projectId ? `?projectId=${formData.projectId}` : ''}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Create Material Request →
              </Link>
              {canAccess('create_material') && (
                <button
                  type="button"
                  onClick={() => {
                    setShowContinueAnyway(true);
                    setEntryType('retroactive_entry'); // Switch to retroactive for emergency cases
                  }}
                  className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium rounded-lg transition"
                >
                  Continue Anyway (Emergency)
                </button>
              )}
              <button
                type="button"
                onClick={() => setEntryType(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition"
              >
                Change Selection
              </button>
            </div>
          </div>
        )}

        {/* Retroactive Entry Warning */}
        {entryType === 'retroactive_entry' && showContinueAnyway && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 font-semibold mb-1">⚠️ Emergency Entry</p>
            <p className="text-sm text-yellow-700">You are creating a retroactive entry. This bypasses the normal purchase workflow. Use only in emergency cases.</p>
          </div>
        )}

        {/* Retroactive Entry Badge */}
        {entryType === 'retroactive_entry' && (
          <div className="mb-6">
            <span className="inline-flex px-3 py-1 bg-gray-100 text-gray-800 text-sm font-semibold rounded-full">
              📝 Retroactive Entry
            </span>
            <p className="text-sm text-gray-600 mt-2">For materials already purchased or on-site. Documentation is optional.</p>
          </div>
        )}

        {/* Progress Steps - Only show if retroactive entry selected */}
        {entryType === 'retroactive_entry' && (
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4, 5].map((s) => {
                const isComplete = step > s;
                const isCurrent = step === s;
                const stepLabels = ['Basic Info', 'Quantities', 'Costs', 'Documents', 'Review'];
                
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                          isComplete
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {isComplete ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          s
                        )}
                      </div>
                      <span className={`text-xs mt-1 text-center ${isCurrent ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                        {stepLabels[s - 1]}
                      </span>
                    </div>
                    {s < 5 && (
                      <div
                        className={`flex-1 h-1 mx-2 transition-all ${
                          isComplete ? 'bg-green-500' : isCurrent ? 'bg-blue-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Form - Only show for retroactive entries */}
        {entryType === 'retroactive_entry' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 relative">
            {changingStep && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
                <LoadingSpinner size="md" color="blue-600" text="Loading step..." />
              </div>
            )}
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Project <span className="text-red-500">*</span>
                </label>
                {projects.length > 0 ? (
                  <select
                    name="projectId"
                    value={formData.projectId}
                    onChange={handleChange}
                    required
                    disabled={loadingProjects || loading}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingProjects ? (
                      <option>Loading projects...</option>
                    ) : (
                      <>
                        <option value="">Select a project</option>
                        {projects.map((project) => (
                          <option key={project._id} value={project._id}>
                            {project.projectName || project.projectCode} {project.location ? `- ${project.location}` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <p className="text-sm text-yellow-800 font-semibold mb-2">
                        ⚠️ No projects found
                      </p>
                      <p className="text-xs text-yellow-700 mb-3">
                        You need to create a project before adding materials. Only Project Managers and Owners can create projects.
                      </p>
                      <div className="flex gap-2">
                        <Link
                          href="/projects/new"
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                        >
                          Create New Project
                        </Link>
                        <Link
                          href="/projects"
                          className="inline-flex items-center px-3 py-1.5 bg-white text-blue-600 text-xs font-medium rounded border border-blue-600 hover:bg-blue-50 transition"
                        >
                          View All Projects
                        </Link>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-normal">
                      Or if you have a project ID, you can enter it manually:
                    </p>
                    <input
                      type="text"
                      name="projectId"
                      value={formData.projectId}
                      onChange={handleChange}
                      placeholder="Enter project ID (ObjectId)"
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    />
                  </div>
                )}
                <p className="text-sm text-gray-600 mt-1 leading-normal">
                  Select the project this material belongs to
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Select From Material Library (Optional)</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Use the library to prefill material name, unit, category, and estimated unit cost.
                </p>
                <MaterialLibraryPicker
                  onSelectMaterial={handleLibrarySelect}
                  selectedMaterialId={formData.libraryMaterialId}
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Material Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => {
                    handleChange(e);
                    if (error && e.target.value.trim().length > 0) {
                      setError(null);
                    }
                  }}
                  placeholder="e.g., Portland Cement"
                  required
                  className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
                    step === 1 && !formData.name && error?.includes('name')
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {step === 1 && !formData.name && (
                  <p className="text-sm text-gray-600 mt-1 leading-normal">Enter the name of the material</p>
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Material description..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Category
                  </label>
                  <select
                    name="categoryId"
                    value={formData.categoryId || ''}
                    onChange={(e) => {
                      const selectedCategoryId = e.target.value;
                      if (selectedCategoryId === '') {
                        // Clear category when "Select category" is chosen
                        setFormData(prev => ({
                          ...prev,
                          category: '',
                          categoryId: '',
                        }));
                      } else {
                        const selectedCategory = categories.find(cat => cat._id === selectedCategoryId);
                        setFormData(prev => ({
                          ...prev,
                          category: selectedCategory?.name || '',
                          categoryId: selectedCategoryId,
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loadingCategories || loading}
                  >
                    {loadingCategories ? (
                      <option>Loading categories...</option>
                    ) : (
                      <>
                        <option value="">Select category</option>
                        {categories.length > 0 ? (
                          categories.map((cat) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No categories available</option>
                        )}
                      </>
                    )}
                  </select>
                  {formData.categoryId && formData.category && (
                    <p className="text-sm text-gray-600 mt-1 leading-normal">
                      Selected: <span className="font-medium">{formData.category}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Floor
                  </label>
                  {!formData.projectId ? (
                    <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700 text-sm">
                      Please select a project first to see available floors
                    </div>
                  ) : floors.length === 0 ? (
                    <div className="space-y-2">
                      <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                        No floors available for this project. Floors are automatically created when a project is set up.
                      </div>
                      <Link
                        href={`/floors?projectId=${formData.projectId}`}
                        className="text-sm text-blue-600 hover:underline"
                        target="_blank"
                      >
                        View floors for this project →
                      </Link>
                    </div>
                  ) : (
                    <select
                      name="floor"
                      value={formData.floor}
                      onChange={handleChange}
                      disabled={loadingFloors || loading || !formData.projectId}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingFloors ? (
                        <option>Loading floors...</option>
                      ) : (
                        <>
                          <option value="">Select floor (optional)</option>
                          {floors.map((floor) => {
                            const getFloorDisplay = (floorNumber, name) => {
                              if (name) return name;
                              if (floorNumber === undefined || floorNumber === null) return 'N/A';
                              if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;
                              if (floorNumber === 0) return 'Ground Floor';
                              return `Floor ${floorNumber}`;
                            };
                            return (
                              <option key={floor._id} value={floor._id}>
                                {getFloorDisplay(floor.floorNumber, floor.name)} {floor.status ? `(${floor.status.replace('_', ' ')})` : ''}
                              </option>
                            );
                          })}
                        </>
                      )}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Construction Phase <span className="text-red-500">*</span>
                </label>
                {!formData.projectId ? (
                  <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-700 text-sm">
                    Please select a project first to see available phases
                  </div>
                ) : phases.length === 0 ? (
                  <div className="space-y-2">
                    <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-600 text-sm">
                      No phases available for this project. Phases can be created in the project phases section.
                    </div>
                    <Link
                      href={`/phases?projectId=${formData.projectId}`}
                      className="text-sm text-blue-600 hover:underline"
                      target="_blank"
                    >
                      Manage phases for this project →
                    </Link>
                  </div>
                ) : (
                  <select
                    name="phaseId"
                    value={formData.phaseId}
                    onChange={handleChange}
                    disabled={loadingPhases || loading || !formData.projectId}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPhases ? (
                      <option>Loading phases...</option>
                    ) : (
                      <>
                        <option value="">Select phase</option>
                        {phases.map((phase) => (
                          <option key={phase._id} value={phase._id}>
                            {phase.name} {phase.status ? `(${phase.status.replace('_', ' ')})` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Quantities */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Quantities</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Quantity Purchased <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={(e) => {
                      handleChange(e);
                      if (error && parseFloat(e.target.value) > 0) {
                        setError(null);
                      }
                    }}
                    min="0.01"
                    step="0.01"
                    required
                    className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
                      step === 2 && (!formData.quantity || parseFloat(formData.quantity) <= 0) && error?.includes('quantity')
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {formData.quantity && parseFloat(formData.quantity) > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ Valid quantity</p>
                  )}
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  >
                    {unitOptions.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                  {formData.unit === 'others' && (
                    <input
                      type="text"
                      name="customUnit"
                      value={formData.customUnit}
                      onChange={handleChange}
                      required
                      placeholder="Enter custom unit name"
                      className="w-full mt-2 px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Costs */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Costs & Supplier</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Unit Cost (KES) {entryType === 'retroactive_entry' ? '(Optional)' : <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="number"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={(e) => {
                      handleChange(e);
                      if (error && parseFloat(e.target.value) > 0) {
                        setError(null);
                      }
                    }}
                    min="0"
                    step="0.01"
                    required={entryType !== 'retroactive_entry'}
                    className={`w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 placeholder:text-gray-400 ${
                      step === 3 && (!formData.unitCost || parseFloat(formData.unitCost) <= 0) && error?.includes('cost')
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {formData.unitCost && formData.quantity && (
                    <p className="text-xs text-blue-600 mt-1">
                      Total: KES {calculateTotal()}
                    </p>
                  )}
                  {entryType === 'retroactive_entry' && (
                    <p className="text-xs text-gray-500 mt-1">Optional for retroactive entries</p>
                  )}
                </div>
                {entryType === 'retroactive_entry' && (
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                      Estimated Unit Cost (KES) <span className="text-gray-500">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      name="estimatedUnitCost"
                      value={formData.estimatedUnitCost}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 bg-white text-gray-900 border rounded-lg focus:outline-none focus:ring-2 placeholder:text-gray-400 border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use this if the actual unit cost is unknown. The system will mark costs as estimated.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Total Cost (KES)
                  </label>
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
                    <span className="text-lg font-semibold">{calculateTotal()}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 leading-normal">
                    Auto-calculated {formData.unitCost ? '(actual)' : formData.estimatedUnitCost ? '(estimated)' : ''}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Supplier Name {entryType === 'retroactive_entry' ? '(Optional)' : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  name="supplierName"
                  value={formData.supplierName}
                  onChange={handleChange}
                  placeholder="Supplier company name"
                  required={entryType !== 'retroactive_entry'}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
                {entryType === 'retroactive_entry' && (
                  <p className="text-xs text-gray-500 mt-1">Optional for retroactive entries</p>
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Payment Method
                </label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                >
                  <option value="CASH">Cash</option>
                  <option value="M_PESA">M-Pesa</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={handleChange}
                    placeholder="Invoice #"
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    name="invoiceDate"
                    value={formData.invoiceDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Purchase Date
                </label>
                <input
                  type="date"
                  name="datePurchased"
                  value={formData.datePurchased}
                  onChange={handleChange}
                  max={entryType === 'retroactive_entry' ? new Date().toISOString().split('T')[0] : undefined}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
                {entryType === 'retroactive_entry' && (
                  <p className="text-xs text-gray-500 mt-1">Can be in the past for retroactive entries</p>
                )}
              </div>

              {/* Retroactive Entry Specific Fields */}
              {entryType === 'retroactive_entry' && (
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Retroactive Entry Details</h3>
                  
                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                      Original Purchase Date
                    </label>
                    <input
                      type="date"
                      name="originalPurchaseDate"
                      value={formData.originalPurchaseDate || formData.datePurchased}
                      onChange={(e) => setFormData(prev => ({ ...prev, originalPurchaseDate: e.target.value }))}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Date when the material was originally purchased (can be in the past)</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                        Documentation Status
                      </label>
                      <select
                        name="documentationStatus"
                        value={formData.documentationStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, documentationStatus: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="complete">Complete</option>
                        <option value="partial">Partial</option>
                        <option value="missing">Missing</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                        Cost Status
                      </label>
                      <select
                        name="costStatus"
                        value={formData.costStatus}
                        onChange={(e) => setFormData(prev => ({ ...prev, costStatus: e.target.value }))}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="actual">Actual</option>
                        <option value="estimated">Estimated</option>
                        <option value="missing">Missing</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                      Retroactive Notes
                    </label>
                    <textarea
                      name="retroactiveNotes"
                      value={formData.retroactiveNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, retroactiveNotes: e.target.value }))}
                      rows={3}
                      placeholder="Explain why this is a retroactive entry (e.g., material was on-site for a long time, receipt was lost, purchased before system implementation...)"
                      className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    />
                    <p className="text-xs text-gray-500 mt-1">Recommended: Explain the retroactive nature of this entry</p>
                  </div>
                </div>
              )}

              {/* Finishing Details Section - Conditional based on category */}
              {isFinishingCategory(formData.category) && (() => {
                const finishingType = getFinishingCategoryType(formData.category);
                return (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Finishing Details
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Additional information for {formData.category}
                    </p>

                    {/* Electrical Works */}
                    {finishingType === 'electrical' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Brand <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.brand}
                            onChange={(e) => handleFinishingChange('brand', e.target.value)}
                            placeholder="e.g., Schneider, Legrand"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Technician Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.technicianName}
                            onChange={(e) => handleFinishingChange('technicianName', e.target.value)}
                            placeholder="Name of electrician"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Installation Date
                          </label>
                          <input
                            type="date"
                            value={formData.finishingDetails.installationDate}
                            onChange={(e) => handleFinishingChange('installationDate', e.target.value)}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Plumbing Works */}
                    {finishingType === 'plumbing' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Brand <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.brand}
                            onChange={(e) => handleFinishingChange('brand', e.target.value)}
                            placeholder="e.g., Grohe, Hansgrohe"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Technician Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.technicianName}
                            onChange={(e) => handleFinishingChange('technicianName', e.target.value)}
                            placeholder="Name of plumber"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Installation Date
                          </label>
                          <input
                            type="date"
                            value={formData.finishingDetails.installationDate}
                            onChange={(e) => handleFinishingChange('installationDate', e.target.value)}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Joinery/Carpentry */}
                    {finishingType === 'joinery' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Material Type <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.materialType}
                            onChange={(e) => handleFinishingChange('materialType', e.target.value)}
                            placeholder="e.g., Hardwood, MDF, Plywood"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Installation Team <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.installationTeam}
                            onChange={(e) => handleFinishingChange('installationTeam', e.target.value)}
                            placeholder="Team or company name"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Installation Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={formData.finishingDetails.installationDate}
                            onChange={(e) => handleFinishingChange('installationDate', e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Paintwork */}
                    {finishingType === 'paintwork' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Brand <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.brand}
                            onChange={(e) => handleFinishingChange('brand', e.target.value)}
                            placeholder="e.g., Crown, Dulux"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Colour <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.colour}
                            onChange={(e) => handleFinishingChange('colour', e.target.value)}
                            placeholder="e.g., White, Cream, Beige"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Team Leader
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.teamLeader}
                            onChange={(e) => handleFinishingChange('teamLeader', e.target.value)}
                            placeholder="Name of team leader"
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Tiling & Terrazzo */}
                    {finishingType === 'tiling' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Tile Type <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.tileType}
                            onChange={(e) => handleFinishingChange('tileType', e.target.value)}
                            placeholder="e.g., Ceramic, Porcelain, Terrazzo"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Square Meters Covered <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={formData.finishingDetails.squareMeters}
                            onChange={(e) => handleFinishingChange('squareMeters', e.target.value)}
                            placeholder="e.g., 50.5"
                            min="0"
                            step="0.1"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Supplier <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.brand}
                            onChange={(e) => handleFinishingChange('brand', e.target.value)}
                            placeholder="Tile supplier name"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Lift Installation */}
                    {finishingType === 'lift' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Contract Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.finishingDetails.contractNumber}
                            onChange={(e) => handleFinishingChange('contractNumber', e.target.value)}
                            placeholder="Lift installation contract number"
                            required
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Payment Schedule <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={formData.finishingDetails.paymentSchedule}
                            onChange={(e) => handleFinishingChange('paymentSchedule', e.target.value)}
                            placeholder="Describe payment schedule (e.g., 30% upfront, 40% on delivery, 30% on completion)"
                            required
                            rows={3}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                          />
                        </div>
                        <div>
                          <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                            Warranty Documents <span className="text-red-500">*</span>
                          </label>
                          <CloudinaryUploadWidget
                            uploadPreset="Construction_Accountability_System"
                            folder={formData.projectId ? `Kisheka_construction/lifts/${formData.projectId}` : 'Kisheka_construction/lifts'}
                            label="Upload Warranty Documents"
                            value={formData.finishingDetails.warrantyDocuments?.[0] || null}
                            onChange={(url) => handleFinishingChange('warrantyDocuments', url ? [url] : [])}
                            onDelete={() => handleFinishingChange('warrantyDocuments', [])}
                            maxSizeMB={10}
                            acceptedTypes={['image/*', 'application/pdf']}
                          />
                          <p className="text-sm text-gray-600 mt-1 leading-normal">
                            Upload warranty documents for the lift installation
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 4: Documents */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Documentation</h2>
              <p className="text-gray-600 mb-4">
                Upload receipts, invoices, and delivery notes. All files are securely stored in Cloudinary.
              </p>

              {/* Receipt Upload */}
              <CloudinaryUploadWidget
                uploadPreset="Construction_Accountability_System"
                folder={formData.projectId ? `Kisheka_construction/materials/${formData.projectId}` : 'Kisheka_construction/materials'}
                label="Receipt Photo"
                value={formData.receiptFileUrl}
                onChange={(url) => setFormData(prev => ({ ...prev, receiptFileUrl: url }))}
                onDelete={() => setFormData(prev => ({ ...prev, receiptFileUrl: null }))}
                maxSizeMB={5}
                acceptedTypes={['image/*']}
              />

              {/* Invoice Upload */}
              <CloudinaryUploadWidget
                uploadPreset="Construction_Accountability_System"
                folder={formData.projectId ? `Kisheka_construction/materials/${formData.projectId}` : 'Kisheka_construction/materials'}
                label="Invoice Document"
                value={formData.invoiceFileUrl}
                onChange={(url) => setFormData(prev => ({ ...prev, invoiceFileUrl: url }))}
                onDelete={() => setFormData(prev => ({ ...prev, invoiceFileUrl: null }))}
                maxSizeMB={5}
                acceptedTypes={['image/*', 'application/pdf']}
              />

              {/* Delivery Note Upload */}
              <CloudinaryUploadWidget
                uploadPreset="Construction_Accountability_System"
                folder={formData.projectId ? `Kisheka_construction/materials/${formData.projectId}` : 'Kisheka_construction/materials'}
                label="Delivery Note"
                value={formData.deliveryNoteFileUrl}
                onChange={(url) => setFormData(prev => ({ ...prev, deliveryNoteFileUrl: url }))}
                onDelete={() => setFormData(prev => ({ ...prev, deliveryNoteFileUrl: null }))}
                maxSizeMB={5}
                acceptedTypes={['image/*', 'application/pdf']}
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p className="font-semibold mb-1">📋 Upload Guidelines:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Receipts: Clear photos of purchase receipts (JPG, PNG)</li>
                  <li>Invoices: Supplier invoices (JPG, PNG, or PDF)</li>
                  <li>Delivery Notes: Material delivery documentation (JPG, PNG, or PDF)</li>
                  <li>Maximum file size: 5MB per file</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Review & Submit</h2>
              
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Material Name:</span>
                  <span>{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Quantity:</span>
                  <span>{formData.quantity} {formData.unit === 'others' ? formData.customUnit : formData.unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Unit Cost:</span>
                  <span>
                    KES {parseFloat(formData.unitCost || formData.estimatedUnitCost || 0).toLocaleString()}
                    {formData.unitCost ? '' : formData.estimatedUnitCost ? ' (Estimated)' : ' (Missing)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Total Cost:</span>
                  <span className="font-bold">KES {calculateTotal()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Supplier:</span>
                  <span>{formData.supplierName}</span>
                </div>
                
                {/* Uploaded Files Summary */}
                {(formData.receiptFileUrl || formData.invoiceFileUrl || formData.deliveryNoteFileUrl) && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <p className="font-medium mb-2">Uploaded Documents:</p>
                    <div className="space-y-1 text-sm">
                      {formData.receiptFileUrl && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Receipt uploaded</span>
                        </div>
                      )}
                      {formData.invoiceFileUrl && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Invoice uploaded</span>
                        </div>
                      )}
                      {formData.deliveryNoteFileUrl && (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Delivery note uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-gray-700 mb-1 leading-normal">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex justify-between items-center">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {step < 5 ? (
                <>
                  <LoadingButton
                    type="button"
                    onClick={() => {
                      if (validateStep(step)) {
                        setError(null);
                        setChangingStep(true);
                        setTimeout(() => {
                          setStep(step + 1);
                          setChangingStep(false);
                        }, 150);
                      }
                    }}
                    isLoading={changingStep}
                    loadingText="Loading..."
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </LoadingButton>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    Edit
                  </button>
                  <LoadingButton
                    type="submit"
                    isLoading={loading}
                    loadingText="Creating..."
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Create Material
                  </LoadingButton>
                </>
              )}
            </div>
          </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}

export default function NewItemPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        </div>
      </AppLayout>
    }>
      <NewItemPageContent />
    </Suspense>
  );
}

